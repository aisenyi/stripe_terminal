erpnext.PointOfSale.StripeTerminal = function(){
	var connectiontoken = "";
	var terminal;
	var loading_dialog,message_dilaog;
	var payment_object,is_online;

	this.assign_stripe_connection_token = function(payment, is_online) {
		payment_object = payment;
		is_online = is_online;
		show_loading_modal();
		frappe.call({
			method: "stripe_terminal.stripe_terminal.api.get_stripe_terminal_token",
			freeze: true,
			headers: {
				"X-Requested-With": "XMLHttpRequest"
			},
			callback: function (r) {
				if (r.message) {
					connectiontoken = r.message.secret;
					terminal = StripeTerminal.create({
						onFetchConnectionToken: fetchConnectionToken,
						onUnexpectedReaderDisconnect: unexpectedDisconnect,

					});

					connect_to_stripe_terminal(payment, is_online);
				} else {
					show_error_dialog('Please configure the stripe settings.');
				}
			}
		});
	}

	function fetchConnectionToken() {
		return connectiontoken;

	}

	function show_loading_modal() {
		loading_dialog = new frappe.ui.Dialog({
			title: 'Collecting Payments',
			fields: [{
					label: '',
					fieldname: 'show_dialog',
					fieldtype: 'HTML'

				},

			],

		});
		var html = '<div style="min-height:200px;position: relative;text-align: center;padding-top: 75px;line-height: 25px;font-size: 15px;">';
		html += '<div style="">Please Wait<br>Collecting Payments</div>';
		html += '</div>';
		loading_dialog.fields_dict.show_dialog.$wrapper.html(html);
		loading_dialog.show();
	}

	function unexpectedDisconnect() {
		console.log("Error")
	}

	function connect_to_stripe_terminal(payment, is_online) {
		frappe.call({
			method: "stripe_terminal.stripe_terminal.api.get_stripe_terminal_settings",
			freeze: true,
			args: {
				"sales_invoice": payment.frm.doc
			},
			headers: {
				"X-Requested-With": "XMLHttpRequest"
			},
			callback: function (r) {
				var isSimulated = false;
				var testCardNumber = "";
				var testCardtype = "";
				if (r.message != undefined) {
					if (r.message.enable_test_mode == 1) {
						isSimulated = true;
						testCardNumber = r.message.card_number;
						testCardtype = r.message.card_type;

					}

				}

				var config = {
					simulated: isSimulated
				};
				terminal.discoverReaders(config).then(function (discoverResult) {
					if (discoverResult.error) {
						loading_dialog.hide();
						show_error_dialog('No readers found.');
					} else if (discoverResult.discoveredReaders.length === 0) {
						loading_dialog.hide();
						show_error_dialog('No readers found.');

					} else {
						// Just select the first reader here.
						var selectedReader = discoverResult.discoveredReaders[0];
						terminal.connectReader(selectedReader).then(function (connectResult) {
							if (connectResult.error) {
								loading_dialog.hide();
								show_error_dialog('Failed to connect.' + connectResult.error.message);

							} else {
								if (r.message.enable_test_mode == 1 && testCardNumber != "" && testCardtype != "") {
									terminal.setSimulatorConfiguration({
										'testCardNumber': testCardNumber,
										'testPaymentMethod': testCardtype
									});
								}
								collecting_payments(payment, is_online);
							}
						});
					}
				});
			}
		});
	}

	function collecting_payments(payment, is_online) {
		frappe.call({
			method: "stripe_terminal.stripe_terminal.api.payment_intent_creation",
			freeze: true,
			args: {
				"sales_invoice": payment.frm.doc
			},
			headers: {
				"X-Requested-With": "XMLHttpRequest"
			},
			callback: function (r) {
				terminal.collectPaymentMethod(r.message.client_secret).then(function (result) {
					if (result.error) {
						loading_dialog.hide();
						show_error_dialog(result.error.message);
					} else {
						terminal.processPayment(result.paymentIntent).then(function (result) {
							if (result.error) {
								loading_dialog.hide();
								show_error_dialog(result.error.message);
							} else if (result.paymentIntent) {
								frappe.call({
									method: "stripe_terminal.stripe_terminal.api.capture_payment_intent",
									freeze: true,
									args: {
										"payment_intent_id": r.message.id,
										"sales_invoice_id": payment.frm.doc.name
									},
									headers: {
										"X-Requested-With": "XMLHttpRequest"
									},
									callback: function (intent_result) {

										loading_dialog.hide();

										if (is_online) {
											payment.frm.savesubmit()
												.then((sales_invoice) => {
													if (sales_invoice && sales_invoice.doc) {
														payment.frm.doc.docstatus = sales_invoice.doc.docstatus;
														frappe.show_alert({
															indicator: 'green',
															message: __(`POS invoice ${sales_invoice.doc.name} created succesfully`)
														});
														frappe.call({
															method: "stripe_terminal.stripe_terminal.api.update_payment_intent",
															freeze: true,
															args: {
																"payment_intent_id": r.message.id,
																"sales_invoice_id": sales_invoice.doc.name
															},
															headers: {
																"X-Requested-With": "XMLHttpRequest"
															},
															callback: function (intent_result) {
																/*payment.toggle_editing();
																payment.set_form_action();
																payment.set_primary_action_in_modal();
																cur_frm.print_preview.printit(true)
																setTimeout(function(){ payment.frm.msgbox.hide();payment.make_new_invoice();}, 2000); */
																payment.toggle_components(false);
																payment.order_summary.toggle_component(true);
																payment.order_summary.load_summary_of(payment.frm.doc, true);
															}
														});
													}
												});

										} else {
											payment.submit_invoice();
										}
									}
								})
							}
						});
					}
				});

			}
		})
	}
	function retry_stripe_terminal()
	{
		message_dilaog.hide();
		assign_stripe_connection_token(payment_object, is_online);
	}
	function change_payment_method()
	{
		message_dilaog.hide();
		$(".num-col.brand-primary").click();
		
	}
	function show_error_dialog(message) {
		message_dilaog = new frappe.ui.Dialog({
			title: 'Message',
			fields: [{
					label: '',
					fieldname: 'show_dialog',
					fieldtype: 'HTML'

				},

			],

		});
		var html = "<p>" + message + "</p><p style='margin-top: 20px;'><a class='btn btn-primary' style='margin-right:10px' onclick='retry_stripe_terminal()'>Retry<a><a class='btn btn-primary' onclick='change_payment_method()'>Change Payment Mode</a></p>";
		message_dilaog.fields_dict.show_dialog.$wrapper.html(html);
		message_dilaog.show();
	}
}
