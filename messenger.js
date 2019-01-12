'use strict';

const request = require('request');

const { MESSENGER_API_ENDPOINT = 'https://opendata-api.stib-mivb.be', MESSENGER_VERIFY_TOKEN = null, MESSENGER_PROFILE_TOKEN = null } = process.env;

module.exports = class Messenger {
	constructor() {
		this.messenger_api_endpoint = MESSENGER_API_ENDPOINT;
		this.messenger_verify_token = MESSENGER_VERIFY_TOKEN;
		this.messenger_profile_token = MESSENGER_PROFILE_TOKEN;
	}

	handleVerify(req, res) {
		if (req.query['hub.verify_token'] === this.messenger_verify_token) {
			return res.send(req.query['hub.challenge']);
		}
		return res.send('Validation failed, Verify token mismatch');
	}

	sendMessage(recipientId, message) {
		let { text = 'Bienvenue sur GoSTIB, le Bot messenger de Gautier !' } = message || {};

		return new Promise((resolve, reject) => {
			request({
				url: `${this.messenger_api_endpoint}`,
				method: 'POST',
				qs: {
					access_token: `${this.messenger_profile_token}`
				},
				json: {
					recipient: { id: recipientId },
					message: {
						text: text,
						quick_replies: [
							{
								content_type: 'text',
								title: 'STOP',
								payload: 'POSTBACK_STOP'
							},
							{
								content_type: 'text',
								title: 'SCAN',
								payload: 'POSTBACK_SCAN'
							}
						]
					}
				}
			}, (error) => {
				if (error) reject(error);
				return resolve(true);
			});
		});
	}
}
