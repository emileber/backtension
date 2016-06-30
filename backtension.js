// Backtension.js

// (c) 2016 Émile Bergeron
// Freely distributed under the MIT license
// For usage and documentation:
// http://backtensionjs.com

(function(root, factory) {

    if (typeof exports !== 'undefined') {
        // Define as CommonJS export:
        module.exports = factory(require("underscore"), require("backbone"));
    } else if (typeof define === 'function' && define.amd) {
        // Define as AMD:
        define(["underscore", "backbone"], factory);
    } else {
        // Just run it:
        factory(root._, root.Backbone);
    }

})(this, function(_, Backbone) {

    Backbone.Extension = {};

    /////////////////
    // Event mixin //
    /////////////////
    Backbone.Extension.Events = _.extend(Backbone.Events, {
        /**
         * Make sure the other objects not null before calling
         * stopListening to ensure only some listeners are removed, not all.
         * @param  {Object} other object to trop lstening to.
         * @return {View} this in order to chain calls.
         */
        stopListeningTo: function(other) {
            if (other === undefined || other === null) {
                return this;
            }
            return this.stopListening.apply(this, arguments);
        },

        funnelEventFrom: function(obj, fromEvents, toEvent) {
            this.listenTo(obj, fromEvents, function() {
                this.trigger(toEvent, arguments);
            });
        },
    });
    _.extend(Backbone, Backbone.Extension.Events);
    _.extend(Backbone.Router.prototype, Backbone.Extension.Events);


    /////////////////
    // Model mixin //
    /////////////////
    var Model = Backbone.Model;
    Backbone.Extension.Model = Model.extend(_.extend({}, Backbone.Extension.Events, {

        /**
         * attributes to be stripped before sending data to the backend.
         * Used in save.
         * @type {Array}
         */
        blacklist: [],

        /**
         * Sanitize the attributes hash (passed or the full one) without the
         * blacklisted attributes, through the blacklist class attribute, or
         * through the option. Pass false to the blacklist option to bypass the
         * sanitising with the blacklist.
         * @param  {Object} attrs selected attributes or null.
         * @param  {Object} options
         * @return {Object}  the sanitized attributes.
         */
        sanitizedAttributes: function(attrs, options) {
            var attributes = attrs || this.attributes;
            if (options.blacklist !== false && !_.isEmpty(this.blacklist)) {
                return _.omit(attributes, _.union(this.blacklist, options.blacklist));
            }
            return attributes;
        },

        /**
         * Set the id property whatever the real field name is.
         * @param  {string} id  new value to set.
         * @param  {Object} opt options hash to pass to the default set method.
         * @return {Object|Boolean}     [description]
         */
        setId: function(id, options) {
            return this.set(this.idAttribute, id, options);
        },

        /**
         * Clears the model's attributes and sets the default attributes.
         * @param  {Object} attributes to overwrite defaults
         * @param  {Object} options  to pass with the "set" call.
         * @return {Backbone.Model}  this object, to chain function calls.
         */
        reset: function(attributes, options) {
            var attrs = attributes || {};
            options = _.extend({ reset: true }, options);

            // Overwrite the defaults with passed attributes, if any.
            var defaults = _.result(this, 'defaults');
            attrs = _.defaults(_.extend({}, defaults, attrs), defaults);

            this._reset(attrs, options);

            // Triggers a custom event, namespaced to model in order
            // to avoid collision with collection's native reset event
            // when listening to a collection.
            if (!options.silent) {
                this.trigger('model:reset', this, options);
            }

            return this;
        },

        /**
         * Private method to help wrapping reset with custom behavior in child
         * classes.
         * @param  {Object} attributes to overwrite defaults
         * @param  {Object} options  to pass with the "set" call.
         */
        _reset: function(attrs, options) {
            this.clear({ silent: true }).set(attrs, options);
        },

        /**
         * Check if a another model has the same model id and type.
         * @param  {Object} model backbone
         * @return {Boolean} true if is the same type and same id.
         */
        is: function(model) {
            return Boolean(model && // model is defined
                ((this === model) || // comparing to the same instance
                    (model instanceof this.constructor) && // model is the same "class"
                    ((!_.isUndefined(this.id) && (this.id === model.id)) || // has same id if applicable
                        (this.cid === model.cid)))); // or same cid otherwise
        },


        save: function(attrs, options) {
            options = options || {};

            // sanitizes this model's attributes using the blacklist
            options.attrs = this.sanitizedAttributes(attrs, options);

            return Model.prototype.save.call(this, attrs, options);
        },

        /**
         * Clone with additional "deep" option.
         * @param  {Object} options to set deep.
         * @return {Backbone.View} with the same attributes, copied over.
         */
        clone: function(options) {
            options = options || {};
            if (options.deep) {
                return new this.constructor(Backbone.$.extend(true, {}, this.attributes));
            } else {
                return Model.prototype.clone.call(this);
            }
        },

        /**
         * Offers to sanitized this model's attributes using the blacklist.
         * Defaults to the normal behavior.
         * @return {Object} Return a shallow copy of the model's attributes for JSON stringification.
         */
        toJSON: function(options) {
            return _.clone(this.sanitizedAttributes(null, _.extend({ blacklist: false }, options)));
        },

    }));
    Backbone.Model = Backbone.Extension.Model;


    //////////////////////
    // Collection mixin //
    //////////////////////
    var Collection = Backbone.Collection;
    Backbone.Extension.Collection = Collection.extend(_.extend({}, Backbone.Extension.Events, {
        model: Backbone.Model,

        isValid: function(options) {
            return _.every(this.invoke("isValid", options));
        },
    }));
    Backbone.Collection = Backbone.Extension.Collection;


    ////////////////
    // View mixin //
    ////////////////
    var View = Backbone.View;
    Backbone.Extension.View = View.extend(_.extend({}, Backbone.Extension.Events, {

        constructor: function(options) {
            this.childViews = this._childViewsDump = [];
            this.url = {};
            View.apply(this, arguments);
        },

        /**
         * To be filled with reference urls
         * @type {Object}
         */
        setUrl: function(key, url) {
            if (!key) {
                return;
            }
            this.url[key] = url;
        },

        removeChildViews: function(options) {
            options = options || {};
            this._childViewsDump = this._childViewsDump.concat(this.childViews);
            this.childViews = [];

            while (this._childViewsDump.length > 0) {
                var currentView = this._childViewsDump.pop();
                if (options.defer) {
                    _.defer(currentView.remove.bind(currentView), options);
                } else {
                    currentView.remove(options);
                }
            }
        },
        disableChildViews: function() {
            _.each(this.childViews, function(view) {
                view.disable();
            });
        },

        /**
         * Calling the html() function removes listeners from all sub-views (the event hash) in subsequent renders.
         * To fix this, we need to use setElement() which calls delegateEvents() then we render.
         * @param  {Backbone.View} view which you want to render.
         * @param  {string|Object} elem selector or jQuery object of an element inside "this" el.
         * @return {Backbone.View} to enable chaining as if render was the last call.
         */
        assign: function(view, elem, options) {
            options = options || {};

            if (_.isString(elem)) {
                // prevent assigning a global element to the view.
                // and ensure it's only assigned to one element.
                elem = this.$(elem).first();
            }
            view.setElement(elem).applyAttributes();
            if (options.defer) {
                _.defer(view.render.bind(view));
            } else {
                view.render();
            }


            return view; // chaining FTW
        },

        /**
         * Apply the attributes (the class hash, className, and id) appending
         * to the current el if necessary and possible.
         */
        applyAttributes: function() {
            // ensure attributes
            var attrs = _.extend({}, _.result(this, 'attributes'));
            if (this.id) attrs.id = _.result(this, 'id');
            this._setAttributes(attrs);
            if (this.className) this.$el.addClass(_.result(this, 'className'));

            return this;
        },



        /**
         * Takes the regions hash and builds a new zone object filled with cached $el.
         * this.regions.myRegion becomes this.zone.$myRegion
         * this.regions.sub.mySubRegion becomes this.zone.sub.$mySubRegion
         */
        generateZones: function(regions, zones) {
            if (_.isUndefined(regions)) {
                regions = this.regions;
                this.zone = {};
                zones = this.zone;
            }
            _.each(regions, function(value, key) {
                if (_.isObject(value) && !_.isEmpty(value)) {
                    zones[key] = {};
                    this.generateZones(value, zones[key]);
                } else {
                    zones['$' + key] = this.$(value);
                }
            }, this);
        },

        /**
         * Disables all event bindings and listeners.
         * You may implement onDisable to hook to view disabling.
         */
        disable: function() {
            this.onDisable();
            this.undelegateEvents();
            this.undelegateGlobalEvents();
            // this.stopListening();
            // _.defer(this.disableChildViews.bind(this));

            // convinience disable loop
            _.each(this.view, function(view) {
                if (view.disable) {
                    _.defer(view.disable.bind(view));
                }
            });
        },
        /** To be overwritten by child views */
        onDisable: function() {},

        /**
         * Completely removes the view after calling onRemove.
         */
        remove: function(options) {
            options = options || {};
            this.onRemove(options);
            this.undelegateGlobalEvents();
            this.removeChildViews(options);

            // convinience remove loop
            _.each(this.view, function(view) {
                if (view.remove) {
                    if (options.defer) {
                        _.defer(view.remove.bind(view), options);
                    } else {
                        view.remove(options);
                    }

                }
            });

            return View.prototype.remove.apply(this, arguments);
        },
        /** To be overwritten by child views */
        onRemove: function() {},

        /**
         * Registering to global events automatically the same way as the
         * usual backbone events.
         */
        delegateGlobalEvents: function(events) {
            events = events || _.result(this, 'globalEvents');
            if (!events) return this;
            this.undelegateGlobalEvents();

            var delegateEventSplitter = /^(\S+)\s*(.*)$/;
            for (var key in events) {
                var method = events[key];
                if (!_.isFunction(method)) method = this[method];
                if (!method) continue;
                var match = key.match(delegateEventSplitter);
                this.delegateGlobal(match[1], match[2], _.bind(method, this));
            }
            return this;
        },

        /**
         * Register to a scoped event on a global object (window or document).
         * @param  {string} eventName to listen to.
         * @param  {string} selector
         * @param  {function} listener  callback
         * @return {Backbone.View} as a way to chain function calls.
         */
        delegateGlobal: function(eventName, selector, listener) {
            var $elem = Backbone.$(_.isEmpty(selector) ? window : document);
            $elem.on(eventName + '.delegateGlobalEvents' + this.cid, selector, listener);
            return this;
        },
        undelegateGlobalEvents: function() {
            Backbone.$(window).off('.delegateGlobalEvents' + this.cid);
            Backbone.$(document).off('.delegateGlobalEvents' + this.cid);
            return this;
        },
        undelegateGlobal: function(eventName, selector, listener) {
            var $elem = Backbone.$(_.isEmpty(selector) ? window : document);
            $elem.off(eventName + '.delegateGlobalEvents' + this.cid, selector, listener);
            return this;
        },

        /** Add the global event behavior to the normal flow. */
        setElement: function(element) {
            this.undelegateGlobalEvents();
            View.prototype.setElement.call(this, element);
            this.delegateGlobalEvents();
            return this;
        },

    }));
    Backbone.View = Backbone.Extension.View;


    ////////////////////////////
    // Backbone.history mixin //
    ////////////////////////////
    Backbone.Extension.History = {

        /**
         * Returns true if the provided prefix is in the current fragment (#).
         * @param  {string} prefix as a fragment
         * @return {Boolean} true if prefix is in the current fragment.
         */
        hasPrefix: function(prefix) {
            if (prefix.charAt(0) === '#') {
                prefix = prefix.slice(1);
            }

            if (this.getHash().slice(0, prefix.length) === prefix) {
                return true;
            }
            return false;
        },

        relative: function(url) {
            var fragment = this.getFragment();
            if (fragment.slice(-1) !== '/') {
                fragment += '/';
            }
            return "#/" + fragment + url;
        },

    };
    _.extend(Backbone.history, Backbone.Extension.Events, Backbone.Extension.History);

    return Backbone.Extension;

});
