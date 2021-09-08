erpnext.PointOfSale.Controller = class extends erpnext.PointOfSale.Controller{
	make_app() {
		this.prepare_dom();
		this.prepare_components();
		this.prepare_menu();
		this.make_new_invoice();
		this.init_stripe_terminal();
	}
	
	init_stripe_terminal(){
		this.stripe = new erpnext.PointOfSale.StripeTerminal();
		frappe.dom.freeze();
		//this.stripe.connect_to_stripe_terminal(this, true);	
		this.stripe.assign_stripe_connection_token(this, true);
		frappe.dom.unfreeze();
	}
	
	init_payments() {
		this.payment = new erpnext.PointOfSale.Payment({
			wrapper: this.$components_wrapper,
			events: {
				get_frm: () => this.frm || {},

				get_customer_details: () => this.customer_details || {},

				toggle_other_sections: (show) => {
					if (show) {
						this.item_details.$component.is(':visible') ? this.item_details.$component.css('display', 'none') : '';
						this.item_selector.$component.css('display', 'none');
					} else {
						this.item_selector.$component.css('display', 'flex');
					}
				},

				submit_invoice: () => {
					var allowSubmit = 1;
					if(frappe.sys_defaults.installed_apps.indexOf("stripe_terminal")>-1)
					{
						
						if(this.frm.doc.payments.length > 0)
						{
							for (var i=0;i<=this.frm.doc.payments.length;i++) {
								if(this.frm.doc.payments[i] != undefined){
									
									 if(this.frm.doc.payments[i].mode_of_payment == "Stripe" && this.frm.doc.payments[i].base_amount != 0)
									 {
										if(this.frm.doc.payments[i].amount > 0)
										{
											allowSubmit = 0;
										}
										else if(this.frm.doc.is_return == 1 && this.frm.doc.payments[i].card_payment_intent){
											allowSubmit = 0;
										}
										else if(this.frm.doc.is_return == 1 && !this.frm.doc.payments[i].card_payment_intent){
											frappe.throw("This transaction was not paid using a Stripe Payment. Please change the return payment method.");
										}
									 }
								}
							}
						}
					}

					if (allowSubmit == 1){
						this.frm.savesubmit()
							.then((r) => {
								this.toggle_components(false);
								this.order_summary.toggle_component(true);
								this.order_summary.load_summary_of(this.frm.doc, true);
								frappe.show_alert({
									indicator: 'green',
									message: __('POS invoice {0} created succesfully', [r.doc.name])
								});
							});
					}
					else{
						//var stripe = new erpnext.PointOfSale.StripeTerminal();
						//this.stripe.assign_stripe_connection_token(this,true);
						this.stripe.collecting_payments(this, true);
					}
				}
			}
		});
	}
	
	async on_cart_update(args) {
		frappe.dom.freeze();
		let item_row = undefined;
		try {
			let { field, value, item } = args;
			const { item_code, batch_no, serial_no, uom } = item;
			item_row = this.get_item_from_frm(item_code, batch_no, uom);

			const item_selected_from_selector = field === 'qty' && value === "+1"

			if (item_row) {
				item_selected_from_selector && (value = item_row.qty + flt(value))

				field === 'qty' && (value = flt(value));

				if (['qty', 'conversion_factor'].includes(field) && value > 0 && !this.allow_negative_stock) {
					const qty_needed = field === 'qty' ? value * item_row.conversion_factor : item_row.qty * value;
					await this.check_stock_availability(item_row, qty_needed, this.frm.doc.set_warehouse);
				}

				if (this.is_current_item_being_edited(item_row) || item_selected_from_selector) {
					await frappe.model.set_value(item_row.doctype, item_row.name, field, value);
					this.update_cart_html(item_row);
				}

			} else {
				if (!this.frm.doc.customer) {
					frappe.dom.unfreeze();
					frappe.show_alert({
						message: __('You must select a customer before adding an item.'),
						indicator: 'orange'
					});
					frappe.utils.play_sound("error");
					return;
				}
				if (!item_code) return;

				item_selected_from_selector && (value = flt(value))

				const args = { item_code, batch_no, [field]: value };

				if (serial_no) {
					await this.check_serial_no_availablilty(item_code, this.frm.doc.set_warehouse, serial_no);
					args['serial_no'] = serial_no;
				}

				if (field === 'serial_no') args['qty'] = value.split(`\n`).length || 0;

				item_row = this.frm.add_child('items', args);

				if (field === 'qty' && value !== 0 && !this.allow_negative_stock)
					await this.check_stock_availability(item_row, value, this.frm.doc.set_warehouse);

				await this.trigger_new_item_events(item_row);

				this.check_serial_batch_selection_needed(item_row) && this.edit_item_details_of(item_row);
				this.update_cart_html(item_row);
			}

		} catch (error) {
			console.log(error);
		} finally {
			this.stripe.display_details(this);
			frappe.dom.unfreeze();
			return item_row;
		}
	}
}
