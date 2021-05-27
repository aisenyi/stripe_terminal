erpnext.PointOfSale.Controller = class extends erpnext.PointOfSale.Controller{
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
					console.log("In here");
					var allowSubmit = 1;
					if(frappe.sys_defaults.installed_apps.indexOf("stripe_terminal")>-1)
					{
						
						if(this.frm.doc.payments.length > 0)
						{
							for (var i=0;i<=this.frm.doc.payments.length;i++) {
								if(this.frm.doc.payments[i] != undefined){
									
									 if(this.frm.doc.payments[i].mode_of_payment == "Stripe")
									 {
										if(this.frm.doc.payments[i].amount > 0)
										{
											allowSubmit = 0;
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
						assign_stripe_connection_token(this,true);
					}
				}
			}
		});
	}
}
