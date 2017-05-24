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

    var _result = _.result,
        _extend = _.extend,
        _isUndefined = _.isUndefined,
        _isEmpty = _.isEmpty,
        _isString = _.isString,
        _isObject = _.isObject,
        _isArray = _.isArray,
        _each = _.each,
        _defer = _.defer,
        _clone = _.clone,
        _omit = _.omit,
        _noop = _.noop,
        backbone$ = Backbone.$,
        $window = backbone$(window),
        $document = backbone$(document),
        delegateEventSplitter = /^(\S+)\s*(.*)$/,
        globalEventNamespace = '.delegateGlobalEvents',
        BackboneBackup = _clone(Backbone),
        Backtension = Backbone.Backtension = {};

    /////////////////////////
    // Async helpers mixin //
    /////////////////////////
    var BacktensionAsync = Backtension.Async = {
        /**
         * Utility function that resolves when all passed promises resolves and
         * set the context to this.
         * @param  {Array} promises of models, langs, namespaces to be loaded, etc.
         * @return {promise} which will resolves with this as context.
         */
        when: function(promises) {
            var deferred = backbone$.Deferred();

            backbone$.when.apply(backbone$, _isArray(promises) ? promises : arguments).then(
                function() {
                    deferred.resolveWith(this);
                }.bind(this),
                function() {
                    deferred.rejectWith(this);
                }.bind(this)
            );
            return deferred;
        },
    };

    /////////////////
    // Event mixin //
    /////////////////
    var Events = Backbone.Events;
    var BacktensionEvents = Backtension.Events = _extend({}, Events, BacktensionAsync, {
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
    _extend(Backbone, BacktensionEvents);

    /////////////////
    // Model mixin //
    /////////////////
    var Model = Backbone.Model;
    var BacktensionModel = Backtension.Model = Model.extend(_extend({}, BacktensionEvents, {

        /**
         * Sanitize the attributes hash (defaults to this.attributes) without the
         * blacklisted attributes, through the blacklist array property, or
         * through the option. Pass false to the blacklist option to bypass the
         * sanitising with the blacklist.
         * @param  {Object} attrs selected attributes or null.
         * @param  {Object} options
         * @return {Object}  the sanitized attributes.
         */
        sanitizedAttributes: function(attrs, options) {
            attrs = attrs || this.attributes;
            options = options || {};
            var hasBlacklist = options.blacklist,
                blacklist = _result(this, 'blacklist', []);
            if (hasBlacklist !== false) {
                attrs = _omit(attrs, _.union(blacklist, hasBlacklist));
            }
            return attrs;
        },

        /**
         * Set the id property whatever the real field name is.
         * @param  {string} id - new value to set.
         * @param  {Object} opt - options hash to pass to the default set method.
         * @return {Model}  this - to chain calls.
         */
        setId: function(id, options) {
            var attr = {};
            attr[this.idAttribute] = id;
            return this.set(attr, options);
        },

        /**
         * Clears the model's attributes and sets the default attributes.
         * @param  {Object} attributes to overwrite defaults
         * @param  {Object} options  to pass with the "set" call.
         * @return {Backbone.Model}  this object, to chain function calls.
         */
        reset: function(attributes, options) {
            options = _extend({ reset: true }, options);

            // ensure default params
            var defaults = _result(this, 'defaults');
            attributes = _.defaults(_extend({}, defaults, attributes), defaults);

            // apply
            this._reset(attributes, options);

            // triggers a custom event, namespaced to model in order
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
            return Boolean(model && // model is defined? and
                (this === model || // same instances? or
                    this.id === model || // is this a id?
                    model instanceof this.constructor && // model is the same "class"?
                    (!_isUndefined(this.id) && this.id === model.id || // has same id if applicable?
                        this.cid === model.cid))); // or same cid otherwise?
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
         * @return {Backbone.Model} with the same attributes, copied over.
         */
        clone: function(options) {
            options = options || {};
            if (options.deep) {
                return new this.constructor(backbone$.extend(true, {}, this.toJSON()));
            } else {
                return Model.prototype.clone.call(this);
            }
        },

        /**
         * Like clone, but omit the idAttribute making the new instance ready
         * to be saved as a new object.
         * @param {Object} attrs - which will overwrite the cloned attributes.
         * @param {Object} options - to pass to new instance.
         * @return {Backbone.Model} without an id.
         */
        duplicate: function(attrs, options) {
            return new this.constructor(backbone$.extend(true, {}, _omit(this.toJSON(), this.idAttribute), attrs));
        },

        /**
         * Toggle one or more **boolean** attributes.
         * @param  {String|Array} attrs - one or more attributes to toggle.
         * @param  {[type]} options hash to pass to `set`.
         */
        toggle: function(attrs, options) {
            if (!attrs) return;
            if (!_isArray(attrs)) attrs = [attrs];
            var data = {};
            _each(attrs, function(attr) {
                var value = this.get(attr);
                if (_.isBoolean(value)) {
                    data[attr] = !value;
                }
            }, this);

            return this.set(data, options);
        },

        /**
         * Offers to sanitized this model's attributes using the blacklist.
         * Defaults to the normal behavior.
         * @return {Object} Return a shallow copy of the model's attributes for JSON stringification.
         */
        toJSON: function(options) {
            return _clone(this.sanitizedAttributes(null, _extend({ blacklist: false }, options)));
        },

    }), {
        methodMap: {
            'create': 'POST',
            'update': 'PUT',
            'patch': 'PATCH',
            'delete': 'DELETE',
            'read': 'GET'
        },
    });
    Backbone.Model = BacktensionModel;

    //////////////////////
    // Collection mixin //
    //////////////////////
    var Collection = Backbone.Collection;
    var BacktensionCollection = Backtension.Collection = Collection.extend(_extend({}, BacktensionEvents, {
        model: Backbone.Model,

        isValid: function(options) {
            return _.every(this.invoke("isValid", options));
        },

        /**
         * Move a model from a source index to a target index. Triggers a custom
         * 'move' event which sends (model, src, dest, collection, options).
         * @param  {int} src  index of the model.
         * @param  {int} dest  index of the model.
         * @param  {Object} options additionnal options for the 'add' call.
         * @return {Collection}  this for chaining.
         */
        move: function(src, dest, options) {
            if (src === dest) return this; // don't bother
            options = options || {};
            var model = this.at(src);

            if (!model) return; // no model at position `src`.

            this.remove(model, { silent: true });
            this.add(model, _extend({ at: dest, silent: true }, options));
            if (!options.silent) {
                model.trigger("move", model, src, dest, this, options);
            }
            return this;
        },

        /**
         * Compares its models with the received models.
         * @param  {Array} models of raw objects
         * @return {Boolean} true if identical array of objects.
         */
        equals: function(models) {
            // If we're comparing to undefined (or a falsy value)
            // assume empty array.
            if (!models) models = [];
            if (this.length !== models.length) return false;
            var self = this.toJSON({ blacklist: true, sync: false });
            return _.isEqual(self, models);
        },
        /**
         * Set 'attrs' to all models within the collection.
         * http://stackoverflow.com/a/13887170/1218980
         */
        setModelAttributes: function(attrs, options) {
            this.invoke('set', attrs, options);
            return this;
        },

        /**
         * Hook into the native _prepareModel to offer a standard hook
         * when new model are added to the collection.
         * @param  {Object} model instance or attributes hash.
         * @param  {Object} options
         * @return {Object} model or false on validation error.
         */
        _prepareModel: function(model, options) {
            model = Collection.prototype._prepareModel.apply(this, arguments);
            if (model) this.onNewModel(model, options);
            return model;
        },

        /**
         * Called when adding a new model to the collection.
         * @param  {Object} model instance
         * @param  {Object} options
         */
        onNewModel: _noop,
    }));
    Backbone.Collection = BacktensionCollection;

    ////////////////
    // View mixin //
    ////////////////
    var View = Backbone.View;
    var BacktensionView = Backtension.View = View.extend(_extend({}, BacktensionEvents, {

        constructor: function(options) {
            this.childViews = [];
            // this.url = {};
            View.apply(this, arguments);
        },

        /**
         * To be filled with reference urls
         * @type {Object}
         */
        setUrl: function(key, url) {
            var urlObj = this.url || (this.url = {});
            if (_isString(key)) {
                urlObj[key] = url;
            } else if (_isObject(key)) {
                _extend(urlObj, key);
            }
            return this;
        },

        removeChildViews: function(options) {
            options = options || {};

            var _childViewsDump = [].concat(this.childViews);
            this.childViews = [];

            while (_childViewsDump.length > 0) {
                var currentView = _childViewsDump.shift();
                if (options.defer) {
                    _defer(currentView.remove.bind(currentView), options);
                } else {
                    currentView.remove(options);
                }
            }
            return this;
        },
        disableChildViews: function() {
            _each(this.childViews, function(view) {
                view.disable();
            });
            return this;
        },

        // convinience disable loop
        disableSubViews: function(options) {
            _each(this.view, function(view) {
                if (view.disable) view.disable(options);
            });
            return this;
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

            if (_isString(elem)) {
                // prevent assigning a global element to the view.
                // and ensure it's only assigned to one element.
                elem = this.$(elem).first();
            }
            view.setElement(elem).applyAttributes();
            if (options.defer) {
                _defer(view.render.bind(view));
            } else {
                view.render();
            }

            return this; // chaining FTW
        },

        /**
         * Apply the attributes (the class hash, className, and id) appending
         * to the current el if necessary and possible.
         */
        applyAttributes: function() {
            // ensure attributes
            var attrs = _extend({}, _result(this, 'attributes'));
            if (this.id) attrs.id = _result(this, 'id');
            this._setAttributes(attrs);
            if (this.className) this.$el.addClass(_result(this, 'className'));

            return this;
        },

        /**
         * Takes the regions hash and builds a new zone object filled with cached $el.
         * this.regions.myRegion becomes this.zone.$myRegion
         * this.regions.sub.mySubRegion becomes this.zone.sub.$mySubRegion
         */
        generateZones: function(regions, zones) {
            if (_isUndefined(regions)) {
                regions = _result(this, 'regions');
                zones = this.zone = {};
            }
            _each(regions, function(value, key) {
                if (_isObject(value) && !_isEmpty(value)) {
                    this.generateZones(value, zones[key] = {});
                } else {
                    zones['$' + key] = this.$(value);
                }
            }, this);
            return this;
        },

        renderView: function(viewsKey, viewObj, zoneObj) {
            zoneObj = zoneObj || this.zone;
            viewObj = viewObj || this.view;
            if (!_isArray(viewsKey)) viewsKey = [viewsKey];
            _each(viewsKey, function(view) {
                this.setViewTo(viewObj[view], zoneObj["$" + view]);
            }, this);
            return this;
        },

        setViewTo: function(view, $el) {
            if (view && $el) {
                if (!($el instanceof backbone$)) $el = backbone$($el);
                $el.empty().append(view.render().el);
            }
            return this;
        },

        /**
         * Disables all event bindings and listeners.
         * You may implement onDisable to hook to view disabling.
         */
        disable: function(options) {
            options = options || {};
            if (options.defer) {
                _defer(this._disable.bind(this), options);
            } else {
                this._disable(options);
            }
            return this;
        },

        _disable: function(options) {
            this.onDisable(options);
            this.undelegateEvents();
            this.disableSubViews(options);
        },
        /** To be overwritten by child views */
        onDisable: _noop,

        /**
         * Completely removes the view after calling onRemove.
         */
        remove: function(options) {
            options = options || {};
            this.onRemove(options);
            this.undelegateGlobalEvents();
            this.removeChildViews(options);

            // convinience remove loop
            _each(this.view, function(view) {
                if (view.remove) {
                    if (options.defer) {
                        _defer(view.remove.bind(view), options);
                    } else {
                        view.remove(options);
                    }

                }
            });

            return View.prototype.remove.apply(this, arguments);
        },
        /** To be overwritten by child views */
        onRemove: _noop,

        /**
         * Registering to global events automatically the same way as the
         * usual backbone events.
         */
        delegateGlobalEvents: function(events) {
            events = events || _result(this, 'globalEvents');
            if (!events) return this;
            this.undelegateGlobalEvents();

            _each(events, function(method, key) {
                if (!_.isFunction(method)) method = this[method];
                if (method) {
                    var match = key.match(delegateEventSplitter);
                    this.delegateGlobal(match[1], match[2], _.bind(method, this));
                }
            }, this);

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
            selector = selector || null;
            var $elem = selector ? $document : $window;
            $elem.on(eventName + globalEventNamespace + this.cid, selector, listener);
            return this;
        },
        undelegateGlobalEvents: function() {
            var cid = this.cid;
            $window.off(globalEventNamespace + cid);
            $document.off(globalEventNamespace + cid);
            return this;
        },
        undelegateGlobal: function(eventName, selector, listener) {
            selector = selector || null;
            var $elem = selector ? $document : $window;
            $elem.off(eventName + globalEventNamespace + this.cid, selector, listener);
            return this;
        },

        /** Add the global events behavior to the normal delegate flow. */
        delegateEvents: function(events) {
            if (_isUndefined(events)) this.delegateGlobalEvents();
            return View.prototype.delegateEvents.apply(this, arguments);
        },

        /**
         *  Add the global events behavior to the default setElement.
         * @param {String|jQuery} element for the view to use as its root.
         */
        setElement: function(element) {
            this.undelegateGlobalEvents();
            View.prototype.setElement.apply(this, arguments);
            this.delegateGlobalEvents();
            return this;
        },

    }));
    Backbone.View = BacktensionView;

    //////////////////
    // Router mixin //
    //////////////////
    var Router = Backbone.Router;
    var BacktensionRouter = Backtension.Router = Router.extend(_extend({}, BacktensionEvents, {

        redirect: function(route, options) {
            return Backbone.history.redirect.call(this, route, options);
        },

    }));
    Backbone.Router = BacktensionRouter;

    ////////////////////////////
    // Backbone.history mixin //
    ////////////////////////////
    var History = Backbone.History;
    var BacktensionHistory = Backtension.History = History.extend(_extend({}, BacktensionEvents, {
        trimmedCharacters: ['#', '/', ' '],

        trimHash: function(hash) {
            var trimChars = this.trimmedCharacters;
            while (trimChars.indexOf(hash.charAt(0)) > -1) {
                hash = hash.slice(1);
            }
            while (trimChars.indexOf(hash.slice(-1)) > -1) {
                hash = hash.slice(0, -1);
            }
            return hash;
        },

        /**
         * Returns true if the provided prefix is in the current fragment (#).
         * @param  {string} prefix - as a fragment
         * @return {Boolean} true if prefix is in the current fragment.
         */
        hasPrefix: function(prefix) {
            prefix = this.trimHash(prefix);
            var route = this.trimHash(this.getFragment());
            if (_isEmpty(prefix)) return _isEmpty(route);
            return route.slice(0, prefix.length) === prefix;
        },

        relative: function(url) {
            var fragment = this.getFragment();
            if (fragment.slice(-1) !== '/') {
                fragment += '/';
            }
            return "#/" + fragment + url;
        },

        redirect: function(url, options) {
            options = _extend({
                trigger: true,
                replace: true,
            }, options);
            if (options.defer !== false) {
                _defer(this.navigate.bind(this), url, options);
            } else {
                this.navigate(url, options);
            }
        },

    }));
    Backbone.History = BacktensionHistory;

    //////////////////////////////////
    // Additional data and function //
    //////////////////////////////////
    var urlError = Backtension.urlError = function() {
        throw new Error('A "url" property or function must be specified');
    };

    ///////////////////////////////
    // swap the history instance //
    ///////////////////////////////
    var history = Backbone.history;
    Backbone.history = new BacktensionHistory();

    // call this to cancel the integration within Backbone directly
    Backtension.noConflict = function() {
        _extend(Backbone, BackboneBackup, {
            Events: Events,
            Model: Model,
            Collection: Collection,
            View: View,
            Router: Router,
            History: History,
            history: history,
        });

    };

    return Backtension;
});
