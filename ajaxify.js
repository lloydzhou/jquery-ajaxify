/*!
 * jQuery Ajaxify
 *
 * Copyright (c) 2010
 * Dual licensed under the MIT (MIT-LICENSE.txt)
 * and GPL (GPL-LICENSE.txt) licenses.
 *
 * Author: Jonathan Tropper
 */
(function($) {
    var base = $.fn.ajaxify = function(event, ajaxOptions) {        
        return this.bind(event, function() {
            return base.callbackFor(this).call(this, ajaxOptions);
        }).data('ajaxified', true);
    };
    
    $.extend(base, {
        selectors: {
            'a': function(options) {
                $.extend(options, {
                    url: $(this).attr('href')
                });
                
                $.ajax(options);
                return false;
            },
            'form': function(options) {
                $.extend(options, {
                    type: $(this).attr('method').toUpperCase(),
                    url:  $(this).attr('action'),
                    data: $(this).serialize()
                });
                
                $.ajax(options);
                return false;
            },
            'form[enctype=multipart/form-data]': function(options) {            
                var uuid = '';
                for (i = 0; i < 32; i++) { uuid += Math.floor(Math.random() * 16).toString(16); }
                var unsupported = [];
                var supported = ['beforeSend', 'success', 'error'];
                $.each(options, function(key, value) {
                    if ($.inArray(key, supported) == -1) { unsupported.push(key); }
                });
                if (options.beforeSend) {
                    if (options.beforeSend() == false) { return false; };
                }
                var target_name = 'ajax_target_' + uuid;
                var target = $('<iframe name="' + target_name + '" src="about:blank" style="display: none"></iframe>').appendTo('body');
                var url = $(this).attr('action');
                $(this).attr({
                    action: url + (url.split('?').length > 1 ? '&' : '?') + 'X-Progress-ID=' + uuid,
                    target: target_name,
                    // Set encoding for IE
                    encoding: 'multipart/form-data'
                });
                
                if (options.progress) {
                    function getStatus() {
                        $.ajax({
                            type: 'GET',
                            url: '/file-progress',
                            data: { 'X-Progress-ID': uuid },
                            dataType: 'json',
                            success: function(upload) {
                                if (upload.state == 'starting') {
                                    // Nothing
                                } else if (upload.state == 'uploading') {
                                    upload.percent = Math.floor((upload.received / upload.size) * 1000) / 10;
                                    options.progress(upload);
                                } else {
                                    window.clearTimeout(options.timer);
                                }
                            }
                        });
                    }
                    
                    options.timer = window.setInterval(getStatus, 1000);
                }

                target.load(function() {
                    window.clearTimeout(options.timer);
                    var element = $(this).contents().find('body textarea[name="content"]');
                    var html = element.val();
                    
                    if (options.complete) { options.complete(); }
                    
                    if (html) {
                        var status = parseInt(element.dattr('status'), 10);
                        var successful = (status >= 200 && status < 300) || status == 304 || status == 1223;
                        if ((successful) && (options.success)) { options.success(html); }
                        if ((!successful) && (options.error)) { options.error({ responseText: html }); }
                    } else {
                        html = $(this).contents().find('body').html();
                        if (options.success) { options.success(html); }
                    }
                    
                    target.remove();
                });

            }
        },
        callbackFor: function(element) {
            element = $(element);
            var callback;
            var specificity = 0;
            $.each(base.selectors, function(selector, tempCallback) {
                var tempSpecificity = base.specificityFor(selector);
                if ((element.is(selector)) && (tempSpecificity > specificity)) {
                    callback = tempCallback;
                    specificity = tempSpecificity;
                }
            });
            return callback;
        },
        specificityFor: function(selector) {
            // W3C CSS Specificity: http://www.w3.org/TR/CSS21/cascade.html#specificity
            // Implemented slightly different.
            // But it is much simpler, and you will not notice anything different unless you nest 11 or more selectors,
            // in which there would be much bigger problems with your code.
            
            var specificity = 0;
            var items = selector.split(' ');
            for (var i = items.length - 1; i >= 0; i--) {
                var item = items[i];
                if (base.hasSelector('ID', item)) { specificity += 100; }
                if (base.hasSelector('CLASS', item)) { specificity += 10; }
                if (base.hasSelector('ATTR', item)) { specificity += 10; }
                if (base.hasSelector('PSEUDO', item)) { specificity += 10; }
                if (base.hasSelector('TAG', item)) { specificity += 1; }
            };
            
            return specificity;         
        },
        hasSelector: function(sizzleType, selector) {
            return $.expr.match[sizzleType].test(selector);
        }
    });
    
    $.fn.ajax = function(event, ajaxOptions) {        
        var handler = function(event) {
            event.stopPropagation();
            return base.callbackFor(this).call(this, ajaxOptions);
        };

        return this.one(event, handler).trigger(event);
    };
})(jQuery);
