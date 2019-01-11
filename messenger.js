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

	receiveMessage(req, res) {
		const messageInstances = req.body.entry[0].messaging;
		messageInstances.forEach(async instance => {
			console.log('instance=', instance);

			let { sender: to = null } = instance;
			if (instance && instance.message && instance.message.is_echo) return false;

			try { await await this.sendMessage(to) }
			catch (error) { console.log('ERROR: messenger.js#receiveMessage - Unable to send message:', error) }
		});
		res.sendStatus(200);
	}

	sendMessage(to) {
		return new Promise((resolve, reject) => {
			request({
				url: `${this.api_endpoint}`,
				method: 'POST',
				qs: {
					access_token: `${this.messenger_profile_token}`
				},
				json: {
					recipient: { id: to },
					message: {
						text: 'Bonjour'
					}
				}
			}, (error) => {
				if (error) reject(error);
				return resolve(true);
			});
		});
	}
}
