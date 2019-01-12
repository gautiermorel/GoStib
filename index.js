/* NPM modules */
const dotenv = require('dotenv').config()

const http = require('http');
const express = require('express');
const bodyParser = require('body-parser');
const compression = require('compression');
const moment = require('moment');

const { CronJob } = require('cron');


const Messenger = require('./messenger');

let messenger = new Messenger();

/* Custom modules */
const app = express();

if (dotenv.error) console.log('WARNING: index.js - Unable to load dotenv files');
const { CRON_PATTERN = '0 9 * * *', PORT = 8000 } = process.env;

const STIB = require('./stib');

let stib = new STIB();

app.use(compression());
app.set('case sensitive routing', true);
app.use(bodyParser.json());

app.get('/', async (req, res) => {
	res.send('<html><p>Welcome to STIB - Unofficial endpoint</p></html>');
});

app.get('/webhook/', async (req, res) => {
	messenger.handleVerify(req, res)
});

app.post('/webhook/', async (req, res) => {
	let start = moment();
	let end = moment().add(30, 'minute');

	let messageInstances = req.body.entry[0].messaging;
	let messageInstancesSize = messageInstances.length;

	let promises = [];

	for (let i = 0; i < messageInstancesSize; i++) {
		let instance = messageInstances[i];

		let { id: senderId = null } = (instance && instance.sender) || {};
		let { is_echo = false, text = null, quick_reply = {} } = (instance && instance.message) || {};
		let { payload: postbackPayload = null } = quick_reply;

		if (postbackPayload && postbackPayload === 'POSTBACK_SCAN') {
			stib.run(end, null);
			break;
		}
		if (postbackPayload && postbackPayload === 'POSTBACK_STOP') {
			stib.stop();
			break;
		}

		console.log('INFO: index.js#webhook - Start:', start.toDate(), '| End:', end.toDate());

		if (!is_echo && text) promises.push(messenger.sendMessage(senderId));
	}

	try { await Promise.all(promises) }
	catch (error) {
		console.log('ERROR: messenger.js#receiveMessage - Unable to send message:', error);
	}

	return res.sendStatus(200);
});

const httpServer = http.createServer(app);

httpServer.listen(PORT, () => {
	console.log('Express http server listening on port ', PORT);
});

const job = new CronJob({
	cronTime: CRON_PATTERN,
	onTick: async () => {
		let start = moment();
		let end = moment().add(30, 'minute');

		console.log('INFO: index.js#onTick - Start:', start.toDate(), '| End:', end.toDate());

		stib.run(end, null);

		console.log('INFO: index.js#onTick - End of this range, will wait till the next one');

		return true;
	},
	runOnInit: true,
	start: false
});

job.start();
