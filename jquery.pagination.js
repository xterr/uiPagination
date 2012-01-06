;(function($) {

$.widget("ui.pagination", {
	options : {
		debug                : true,
		ipp                  : 20,
		totalItems           : null,
		currentPage          : 1,
		linksNumber          : 6,
		extraLinksNumber     : 2,
		source               : null,
		ellipseText          : '...',
		cacheResults         : true,
		updateOnFirstRequest : true,
		pageParam            : 'page',
		showLinksOnOnePage   : false,
		labels : {
			prev    : {label : '&larr; Prev', show : true, showAlways : true, classes : 'previous', hiddenClass : 'hidden'},
			next    : {label : 'Next &rarr;', show : true, showAlways : true, classes : 'next', hiddenClass : 'hidden'},
			current : {classes : 'current'},
			page    : {classes : 'page'}
		},
		onBeforeCreate : null,
		onBeforeUpdate : null,
		onAfterUpdate  : null,
		onBeforeSelect : null,
		onAfterSelect  : null
	},
	_pagesList      : null,
	_separator      : null,
	_pager          : null,
	_isFirstRequest : true,

	_create : function() {
		var self = this;
		self._log('Starting plugin');

		if (!self._trigger('onBeforeCreate', null, self))
		{
			return false;
		}

		self._separator = $('<div class="ui-pagination ui-separator"><!-- IE --></div>').insertAfter(self.element);
		self._pager     = $('<div class="ui-pagination ui-pager" />').insertAfter(self._separator);
		self._pagesList = $('<ul class="ui-pages" />').appendTo(self._pager).empty();

		if (self.options.totalItems == null)
		{
			if ($.isArray(self.options.source))
			{
				self.options.totalItems = self.options.source.length;
			}

			if (self.element.attr('data-totalItems') != undefined)
			{
				self.options.totalItems = parseInt(self.element.attr('data-totalItems'));
			}
		}

		if (self.numPages() == 1 && !self.options.showLinksOnOnePage)
		{
			self._log('Only one page. Don`t display the pagination');
			return;
		}

		self._drawLinks();

		if (this._isFirstRequest)
		{
			this._isFirstRequest = false;
			if (this.options.updateOnFirstRequest)
			{
				this.update();
			}
		}

		self._trigger('onAfterCreate', null, self);
	},

	numPages : function() {
		return Math.ceil(this.options.totalItems / this.options.ipp);
	},

	update : function(pageNo) {
		var self        = this;
		var currentPage = pageNo ? pageNo : self.options.currentPage;
		var container   = self.element;
		var cacheKey    = 'results-' + currentPage;

		if (!self._trigger('onBeforeUpdate', null, {currentPage: currentPage, widget: self}))
		{
			return false;
		}

		if (self.options.cacheResults && container.data(cacheKey))
		{
			self._log('Get from cache for page ' + currentPage);
			return self._trigger('onAfterUpdate', null, container.data(cacheKey));
		}

		if ($.isArray(this.options.source))
		{
			var response = {
				status     : 'ok',
				results    : self._filter(self.options.source),
				currentPage: currentPage,
				widget     : self
			};
			self.cacheResults(cacheKey, response);
			return self._trigger('onAfterUpdate', null, response);
		}
		else if (typeof self.options.source === 'string')
		{
			if (self.xhr)
			{
				self.xhr.abort();
			}

			var postData = {
				ipp       : self.options.ipp,
				totalItems: self.options.totalItems,
				numPages  : self.numPages()
			};

			postData[self.options.pageParam] = currentPage;

			self.xhr = $.ajax({
				url      : self.options.source,
				data     : postData,
				dataType : 'json',
				success  : function(results, textStatus, jqXHR) {
					var response = {
						status      : 'ok',
						results     : results,
						currentPage : currentPage,
						textStatus  : textStatus,
						widget      : self
					};

					self.cacheResults(cacheKey, response);
					self._trigger('onAfterUpdate', null, response);
				},
				error : function(jqXHR, textStatus, errorThrown) {
					self._trigger('onAfterUpdate', null, {
						status      : 'error',
						results     : [],
						currentPage : currentPage,
						textStatus  : textStatus,
						errorThrown : errorThrown,
						widget      : self
					});
				}
			});

			return true;
		}
		else
		{
			return false;
		}
	},

	cacheResults : function(cacheKey, data) {
		if (this.options.cacheResults === false)
		{
			return false;
		}

		var data = $.extend({
			status      : 'ok',
			results     : null,
			currentPage : this.options.currentPage,
			widget      : this
		}, data);

		this.element.data(cacheKey, data);
	},

	selectPage : function(pageNo) {
		var self = this;
		self._log('Triggering onBeforeSelect');

		if (!self._trigger('onBeforeSelect', null, {pageNo: pageNo, widget: self}))
		{
			return false;
		}

		if (pageNo == self.options.currentPage)
		{
			self._log('On same page. Don`t do anything.');
			return false;
		}

		pageNo = pageNo < 1 ? 1 : pageNo;
		pageNo = pageNo > this.numPages() ? this.numPages() : pageNo;

		self.options.currentPage = pageNo;
		self._drawLinks();
		self.update();

		self._log('Triggering onAfterSelect');
		self._trigger('onAfterSelect', null, {pageNo: pageNo, widget: self});
	},

	getPreviousPage : function() {
		var currentPage = parseInt(this.options.currentPage) - 1;
		return currentPage < 1 ? 1 : currentPage;
	},

	getNextPage : function() {
		var currentPage = parseInt(this.options.currentPage) + 1;
		return currentPage > this.numPages() ? this.numPages() : currentPage;
	},

	getSeparator : function() {
		return this._separator;
	},

	getPager : function() {
		return this._pager;
	},

	_filter : function(items) {
		var currentPage = this.options.currentPage;
		var ipp         = this.options.ipp;
		var start       = (currentPage - 1) * ipp;
		var end         = Math.min(currentPage * ipp, this.options.totalItems);

		return items.slice(start, end);
	},

	_drawLinks : function(update) {
		var container        = this.element;
		var list             = this._pagesList;
		var interval         = this._getInterval();
		var extraLinksNumber = this.options.extraLinksNumber;
		var ellipseText      = this.options.ellipseText;
		var currentPage      = this.options.currentPage;

		list.empty();

		// Generate previous link
		if (this.options.labels.prev.show == true && (currentPage > 1 || this.options.labels.prev.showAlways))
		{
			var options    = $.extend({}, this.options.labels.prev);
			options.pageNo = this.getPreviousPage();
			options.classes  = currentPage == options.pageNo ? options.classes + ' ' + options.hiddenClass : options.classes;
			list.append(this._getPageLink(options));
		}

		// Generate starting points
		if (interval[0] > 1 && extraLinksNumber > 0)
		{
			var end = Math.min(extraLinksNumber, interval[0]);

			for (var i=1; i<=end; i++)
			{
				var options    = $.extend({}, this.options.labels.page);
				options.label  = i;
				options.pageNo = i;
				list.append(this._getPageLink(options));
			}

			if (extraLinksNumber < interval[0] && ellipseText)
			{
				list.append("<li class='empty'>" + ellipseText+"</li>");
			}
		}

		// Generate inside links
		for (var i=interval[0]; i<=interval[1]; i++)
		{
			var options = $.extend({}, this.options.labels.page);

			if (i == currentPage)
			{
				options = this.options.labels.current;
			}

			options.label  = i;
			options.pageNo = i;

			list.append(this._getPageLink(options));
		}

		// Generate ending points
		if (interval[1] < this.numPages() && extraLinksNumber > 0)
		{
			if(this.numPages() - extraLinksNumber > interval[1] && ellipseText)
			{
				list.append("<li class='empty'>" + ellipseText+"</li>");
			}

			var begin = Math.max(this.numPages() - extraLinksNumber, interval[1]);

			for (var i=begin; i<=this.numPages(); i++)
			{
				var options    = $.extend({}, this.options.labels.page);
				options.label  = i;
				options.pageNo = i;
				list.append(this._getPageLink(options));
			}
		}

		// Generate next link
		if (this.options.labels.next.show == true && (currentPage < this.numPages() || this.options.labels.next.showAlways == true))
		{
			var options    = $.extend({}, this.options.labels.next);;
			options.pageNo = this.getNextPage();
			options.classes  = currentPage == options.pageNo ? options.classes + ' ' + options.hiddenClass : options.classes;
			list.append(this._getPageLink(options));
		}
	},

	_getPageLink : function(options) {
		$.extend({classes: '', label: null, pageNo: null}, options);

		var self = this;
		var li   = $('<li class="'+options.classes+'" />');
		var a    = $('<a href="#" rel="'+options.pageNo+'">'+options.label+'</a>').addClass(options.classes);

		a.bind('click.pagination', function(event) {
			self.selectPage(parseInt($(this).attr('rel')));
			return false;
		}).appendTo(li);

		return li;
	},

	_getInterval : function() {
		var currentPage = this.options.currentPage;
		var ne_half     = Math.ceil(this.options.linksNumber / 2);
		var np          = this.numPages();
		var upper_limit = np - this.options.linksNumber;
		var start       = currentPage > ne_half ? Math.max(Math.min(currentPage - ne_half, upper_limit), 1) : 1;
		var end         = currentPage > ne_half ? Math.min(currentPage + ne_half, np) : Math.min(this.options.linksNumber, np);

		return [start, end];
	},

	_log : function(message) {
		if (this.options.debug == true && window.console != undefined)
		{
			console.log('jQuery.pagination: ' + message);
		}
	}
});
})( jQuery );