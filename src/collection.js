'use strict';

const Promise = require('bluebird');
const _       = require('lodash');
const utils   = require('./utils');

module.exports = class Collection {

    constructor(props, items) {
        this.type      = 'collection';
        this._parent   = props.parent;
        this.name      = props.name;
        this.order     = props.order;
        this.handle    = props.handle || utils.slugify(this.name);
        this.isHidden  = props.isHidden;
        this.label     = props.label || utils.titlize(props.name);
        this.title     = props.title || this.label;
        this.context   = (props.parent ? _.defaultsDeep(props.context || {}, props.parent.context) : props.context ) || {};
        this.labelPath = props.labelPath || _.trimStart(this._makeLabelPath(), '/') || '/';
        this.path      = props.path || _.trimStart(this._makePath(), '/') || '/';
        this._config   = props;
        this._items    = new Set(items || []);
    }

    static create(props, items) {
        return Promise.resolve(new Collection(props, items));
    }

    add(item) {
        this._items.add(item);
    }

    get items() {
        return Array.from(this._items);
    }

    all() {
        return this.items;
    }

    get size() {
        return this._items.size;
    }

    set items(items) {
        this._items = new Set(items || []);
    }

    _makePath() {
        return (this._parent) ? `${this._parent._makePath()}/${this.handle}` : '';
    }

    _makeLabelPath() {
        return (this._parent) ? `${this._parent._makeLabelPath()}/${this.label}` : '';
    }

    toJSON() {
        const result = utils.toJSON(this);
        result.items = this.items.map(i => i.toJSON());
        return result;
    }

    find(str) {
        if (this.size === 0) {
            return undefined;
        }
        for (let item of this) {
            if (item.type === 'collection') {
                const search = item.find(str);
                if (search) return search;
            } else if (item.handle === str || `@${item.handle}` === str) {
                return item;
            }
        }
        return undefined;
    }

    findCollection(str) {
        const type = str.startsWith('@') ? 'handle' : (str.includes('/') ? 'path' : 'handle');
        if (this.size === 0) {
            return undefined;
        }
        for (let item of this) {
            if (item.type === 'collection') {
                if (item[type] === str || `@${item[type]}` === str)  {
                    return item;
                }
                const search = item.findCollection(str);
                if (search) return search;
            }
        }
        return undefined;
    }

    flatten(withCollections) {
        if (withCollections) {
            return this._flattenWithCollections();
        }
        let items = [];
        for (let item of this) {
            if (item.type === 'collection') {
                items = _.concat(items, item.flatten().items);
            } else {
                items.push(item);
            }
        }
        return this.newSelf(items);
    }

    _flattenWithCollections() {
        let items = [];
        let collections = [];
        for (let item of this) {
            if (item.type === 'collection') {
                const childCollections = item.flatten(true).items;
                collections = collections.concat(childCollections);
            } else {
                items.push(item);
            }
        }
        if (items.length) {
            const col = this.newSelf(items);
            collections.unshift(col);
        }
        collections = collections.filter(c => c.items.length > 0);

        // collections = collections.concat(items);
        return this.newSelf(collections, {});
    }

    filter(predicate) {
        let matcher = _.iteratee(predicate);
        let items = [];
        for (let item of this) {
            if (item.type === 'collection') {
                let collection = item.filter(predicate);
                if (collection.size) {
                    items.push(collection);
                }
            } else {
                if (matcher(item)) {
                    items.push(item);
                }
            }
        }
        return this.newSelf(items);
    }

    newSelf(items, props) {
        if (_.isNull(props) || _.isUndefined(props)) {
            props = this._getAttributes();
        }
        return new (this.constructor)(props, items);
    }

    _getAttributes() {
        return {
            order:     this.order,
            isHidden:  this.isHidden,
            label:     this.label,
            title:     this.title,
            name:      this.name,
            handle:    this.handle,
            parent:    this._parent,
            labelPath: this.labelPath,
            path:      this.path
        };
    }

    [Symbol.iterator]() {
        return this.items[Symbol.iterator]();
    }
};