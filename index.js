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
const { CRON_PATTERN = '0 20 * * *', PORT = 8000 } = process.env;

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

app.post('/webhook/', (req, res) => {
	messenger.receiveMessage(req, res)
});

const httpServer = http.createServer(app);

httpServer.listen(PORT, () => {
	console.log('Express http server listening on port ', PORT);
});

const job = new CronJob({
	cronTime: CRON_PATTERN,
	onTick: async () => {
		let start = moment();
		let end = moment().add(1, 'hour');

		console.log('INFO: index.js#onTick - Start:', start.toDate(), '| End:', end.toDate());

		stib.run(end, null);

		console.log('INFO: index.js#onTick - End of this range, will wait till the next one');

		return true;
	},
	runOnInit: true,
	start: false
});

job.start();
