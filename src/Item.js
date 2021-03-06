/*global exports */
/**
 * Creates a new Item.
 *
 * @param {Object} [opt_options=] A map of initial properties.
 * @param {Object} [opt_options.world = undefined] A Bit-Shadow World. Required.
 * @param {number} [opt_options.name = 'Item'] Name.
 *
 * @constructor
 */
function Item(opt_options) {

  var options = opt_options || {};

  if (!options.world || typeof options.world !== 'object') {
    throw new Error('Item: A valid instance of the World class is required for a new Item.');
  }
  this.options = options;
  this.world = options.world;

  this.name = options.name || 'Item';
  this.id = this.name + exports.System.getNewId();
  this.blur = null;
  this.scale = null;
}

/**
 * Initializes the Item.
 */
Item.prototype.init = function() {
  if (console) {
    console.log('init is not implemented.');
  }
};

/**
 * Sets item's properties via initial options.
 *
 * @param {Object} [opt_options=] A map of initial properties.
 * @param {number} [opt_options.blur = 0] Blur.
 * @param {number} [opt_options.scale = 1] Scale. Use to change the item's size.
 * @param {number} [opt_options.opacity = 1] Opacity. Valid values are between 0 and 1.
 * @param {Array} [opt_options.color = [0, 0, 0]] Color.
 */
Item.prototype.reset = function(opt_options) {

  var i, options = opt_options || {};

  // re-assign all options
  for (i in options) {
    if (options.hasOwnProperty(i)) {
      this[i] = options[i];
    }
  }

  this.blur = options.blur || 0;
  this.scale = typeof options.scale === 'undefined' ? 1 : options.scale;
  this.opacity = typeof options.opacity === 'undefined' ? 1 : options.opacity;
  this.color = options.color || [0, 0, 0];
};
