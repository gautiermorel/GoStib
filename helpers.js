'use strict';

const moment = require('moment');

module.exports = class Helpers {
	getRemainingMinutes(time) {
		if (!time) return false;
		let now = moment();
		return Math.round(moment.duration(moment(time).diff(now)).asMinutes())
	}
}
