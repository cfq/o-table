/**
 * Initialises an o-table components inside the element passed as the first parameter
 *
 * @param {(HTMLElement|string)} [el=document.body] - Element where to search for the o-table component. You can pass an HTMLElement or a selector string
 * @returns {OTable} - A single OTable instance
 */
function OTable(rootEl) {
	if (!rootEl) {
		rootEl = document.body;
	} else if (!(rootEl instanceof HTMLElement)) {
		rootEl = document.querySelector(rootEl);
	}
	if (rootEl.getAttribute('data-o-component') === "o-table") {
		this.rootEl = rootEl;
	} else {
		this.rootEl = rootEl.querySelector('[data-o-component~="o-table"]');
	}

	if (this.rootEl !== undefined) {
		this.listeners = [];
		this.isResponsive = false;
		this.rootEl.setAttribute('data-o-table--js', '');

		this.tableHeaders = Array.from(this.rootEl.querySelectorAll('thead th'));
		const tableRows = Array.from(this.rootEl.getElementsByTagName('tr'));

		this.tableHeaders.forEach((th, columnIndex) => {
			// Do not sort headers with attribute.
			if (th.hasAttribute('data-o-table-heading-disable-sort')) {
				return false;
			}

			th.setAttribute('tabindex', "0");

			const listener = this._sortByColumn(columnIndex);
			this.listeners.push(listener);
			th.addEventListener('click', listener);
			th.addEventListener('keydown', (event) => {
				const ENTER = 13;
				const SPACE = 32;
				if ('code' in event) {
					// event.code is not fully supported in the browsers we care about but
					// use it if it exists
					if (event.code === "Space" || event.code === "Enter") {
						listener(event);
					}
				} else if (event.keyCode === ENTER || event.keyCode === SPACE) {
					// event.keyCode has been deprecated but there is no alternative
					listener(event);
				}
			});
		});

		// "o-table--responsive-flat" configuration only works when there is a
		// `<thead>` block containing the table headers. If there are no headers
		// available, the `responsive-flat` class needs to be removed to prevent
		// headings being hidden.
		if (this.rootEl.getAttribute('data-o-table-responsive') === 'flat' && this.tableHeaders.length > 0) {
			this.isResponsive = true;
		} else {
			this.rootEl.classList.remove('o-table--responsive-flat');
		}

		if (this.isResponsive) {
			this._duplicateHeaders(tableRows, this.tableHeaders);
		}

		this.dispatch('ready', {
			oTable: this
		});
	}
}

/**
 * Helper function to dispatch namespaced events, namespace defaults to oTable
 * @param  {String} event
 * @param  {Object} data={}
 * @param  {String} namespace='oTable'
 */
OTable.prototype.dispatch = function (event, data = {}, namespace = 'oTable') {
	this._timeoutID = setTimeout(() => {
		this.rootEl.dispatchEvent(new CustomEvent(namespace + '.' + event, {
			detail: data,
			bubbles: true
		}));
	}, 0);
};

/**
 * Gets a table header for a given column index.
 *
 * @public
 * @returns {element|null} - The header element for the requested column index.
 */
OTable.prototype.getTableHeader = function (columnIndex) {
	return this.tableHeaders[columnIndex] || null;
};

/**
 * Helper function to remove all event handlers which were added during instantiation of the component
 * @returns {undefined}
 */
OTable.prototype.removeEventListeners = function () {
	const tableHeaders = Array.from(this.rootEl.querySelectorAll('thead th'));

	tableHeaders.forEach((th, columnIndex) => {
		th.removeEventListener('click', this.listeners[columnIndex]);
		th.removeEventListener('keydown', this.listeners[columnIndex]);
	});
};

function getIntlCollator() {
	if (typeof Intl !== 'undefined' && {}.hasOwnProperty.call(Intl, 'Collator')) {
		return new Intl.Collator();
	}
}

function ascendingSort(a, b, isNumericValue, intlCollator) {
	if ((typeof a === 'string' || a instanceof String) && (typeof b === 'string' || b instanceof String)) {
		return intlCollator ? intlCollator.compare(a, b) : a.localeCompare(b);
	} else if ((isNumericValue && isNaN(a)) || a < b) {
		return -1;
	} else if ((isNumericValue && isNaN(b)) || b < a) {
		return 1;
	} else {
		return 0;
	}
}

function descendingSort(...args) {
	return 0 - ascendingSort.apply(this, args);
}

/**
 * Sorts the table by a specific column
 * @param  {number} The index of the column to sort the table by
 * @param  {bool} Which direction to sort in, ascending or descending
 * @param  {bool} Whether the values in this column are numeric, if they are numeric we convert the contents into numbers
 * @returns undefined
 */
OTable.prototype.sortRowsByColumn = function (index, sortAscending, isNumericValue) {
	const tbody = this.rootEl.querySelector('tbody');
	const rows = Array.from(tbody.querySelectorAll('tr'));
	const intlCollator = getIntlCollator();
	rows.sort(function (a, b) {
		let aCol = a.children[index];
		let bCol = b.children[index];

		if (aCol.getAttribute('data-o-table-order') !== null) {
			aCol = aCol.getAttribute('data-o-table-order');
			bCol = bCol.getAttribute('data-o-table-order');
			if (!isNaN(parseInt(aCol, 10))) {
				aCol = parseInt(aCol, 10);
				bCol = parseInt(bCol, 10);
			}
		} else {
			aCol = aCol.textContent;
			bCol = bCol.textContent;
		}

		if (isNumericValue) {
			aCol = parseFloat(aCol.replace(/,/g, ''));
			bCol = parseFloat(bCol.replace(/,/g, ''));
		}

		if (sortAscending) {
			return ascendingSort(aCol, bCol, isNumericValue, intlCollator);
		} else {
			return descendingSort(aCol, bCol, isNumericValue, intlCollator);
		}

	});

	rows.forEach(function (row) {
		tbody.appendChild(row);
	});

	this.sorted(index, (sortAscending ? 'ASC' : 'DES'));
};

/**
 * Update the aria sort attributes on a sorted table.
 * Useful to reset sort attributes in the case of a custom sort implementation failing.
 * E.g. One which relies on the network.
 *
 * @private
 * @param {number|null} columnIndex - The index of the currently sorted column, if any.
 * @param {string|null} sort - The type of sort i.e. ASC or DES, if any.
 */
OTable.prototype._updateSortAttributes = function _updateSortAttributes(columnIndex, sort) {
	let ariaSort;
	switch (sort) {
		case 'ASC':
			ariaSort = 'ascending';
			break;
		case 'DES':
			ariaSort = 'descending';
			break;
		default:
			ariaSort = 'none';
			break;
	}
	// Set aria attributes.
	const sortedHeader = this.getTableHeader(columnIndex);
	if (!sortedHeader || sortedHeader.getAttribute('aria-sort') !== ariaSort) {
		this.tableHeaders.forEach((header) => {
			const headerSort = (header === sortedHeader ? ariaSort : 'none');
			header.setAttribute('aria-sort', headerSort);
		});
		this.rootEl.setAttribute('data-o-table-order', sort);
	}
};

/**
 * Indicated that the table has been sorted by firing by a custom sort implementation.
 * Fires the `oTable.sorted` event.
 *
 * @public
 * @param {number|null} columnIndex - The index of the currently sorted column, if any.
 * @param {string|null} sort - The type of sort i.e. ASC or DES, if any.
 */
OTable.prototype.sorted = function (columnIndex, sort) {
	this._updateSortAttributes(columnIndex, sort);
	this.dispatch('sorted', {
		sort,
		columnIndex,
		oTable: this
	});
};

/**
 * Duplicate the table headers into each row
 * For use with responsive tables
 *
 * @private
 * @param  {array} rows Table rows
 */
OTable.prototype._duplicateHeaders = function _duplicateHeaders(rows, headers) {
	rows.forEach((row) => {
		const data = Array.from(row.getElementsByTagName('td'));
		data.forEach((td, dataIndex) => {
			td.parentNode.insertBefore(headers[dataIndex].cloneNode(true), td);
		});
	});
};

/**
 *
 * @private
 * @param {Number} columnIndex
 */
OTable.prototype._sortByColumn = function _sortByColumn(columnIndex) {
	return function (event) {
		const currentSort = event.currentTarget.getAttribute('aria-sort');
		const sort = this.rootEl.getAttribute('data-o-table-order') === null || currentSort === "none" || currentSort === "descending" ? 'ASC' : 'DES';

		/**
		 * Check if sorting has been cancelled on this table in favour of a custom implementation.
		 *
		 * The return value is false if event is cancelable and at least one of the event handlers
		 * which handled this event called Event.preventDefault(). Otherwise it returns true.
		 * https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/dispatchEvent
		 */
		const customSort = !event.currentTarget.dispatchEvent(new CustomEvent('oTable.sorting', {
			detail: {
				sort,
				columnIndex,
				oTable: this
			},
			bubbles: true,
			cancelable: true
		}));

		if (!customSort) {
			this.sortRowsByColumn(columnIndex, sort === "ASC", event.currentTarget.getAttribute('data-o-table-data-type') === 'numeric');
		}

		/**
		 * Update aria attributes to provide immediate feedback.
		 *
		 * This is called again by the `sorted` method to assure accuracy.
		 * I.e. if a sort fails previous sort attributes can be restored via the `sorted` method.
		 */
		this._updateSortAttributes(columnIndex, sort);

	}.bind(this);
};

/**
 * Destroys the instance, removing any event listeners that were added during instatiation of the component
 * @returns undefined
 */
OTable.prototype.destroy = function() {
	if (this._timeoutID !== undefined) {
		clearTimeout(this._timeoutID);
		this._timeoutID = undefined;
	}
	this.rootEl.removeAttribute('data-o-table--js');
	this.removeEventListeners();
	delete this.rootEl;
};

/**
 * Initialises all o-table components inside the element passed as the first parameter
 *
 * @param {(HTMLElement|string)} [el=document.body] - Element where to search for o-table components. You can pass an HTMLElement or a selector string
 * @returns {Array|OTable} - An array of OTable instances or a single OTable instance
 */
OTable.init = function(el = document.body) {
	if (!(el instanceof HTMLElement)) {
		el = document.querySelector(el);
	}
	if (/\bo-table\b/.test(el.getAttribute('data-o-component'))) {
		return new OTable(el);
	}
	const tableEls = Array.from(el.querySelectorAll('[data-o-component~="o-table"]'));
	return tableEls.map(el => {
		return new OTable(el);
	});
};

OTable.wrap = function wrap(tableSelector, wrapClass) {
	tableSelector = typeof tableSelector === "string" ? tableSelector : ".o-table";
	wrapClass = typeof wrapClass === "string" ? wrapClass : "o-table-wrapper";

	const matchingEls = document.querySelectorAll(tableSelector);
	let wrapEl;

	if (matchingEls.length > 0) {
		wrapEl = document.createElement('div');
		wrapEl.setAttribute("class", wrapClass);

		for (let c = 0, l = matchingEls.length; c < l; c++) {
			const tableEl = matchingEls[c];

			if (!tableEl.parentNode.matches("." + wrapClass)) {
				wrapElement(tableEl, wrapEl.cloneNode(false));
			}
		}
	}
};

function wrapElement(targetEl, wrapEl) {
	const parentEl = targetEl.parentNode;
	parentEl.insertBefore(wrapEl, targetEl);
	wrapEl.appendChild(targetEl);
}

module.exports = OTable;
