/*global exports, document */
/**
 * Creates a new World.
 *
 * @param {Object} [opt_options=] A map of initial properties.
 * @param {Object} [opt_options.gravity = new Vector(0, 0.01)] Gravity vector.
 * @param {number} [opt_options.c = 0.1] Coefficient of friction.
 * @param {number} [opt_options.resolution = 4] The world resolution. Items with scale = 1 will
 *   render with this value as their spread value.
 * @param {number} [opt_options.width = viewportSize.width / this.resolution] The world's width.
 * @param {number} [opt_options.height = viewportSize.height / this.resolution] The world's height.
 * @param {number} [opt_options.borderRadius = 0] The world's borderRadius expressed as a percentage.
 *   Some browsers (Safari) will pass this value to the world's box-shadows.
 * @param {number} [opt_options.opacity = 1] The world's opacity.
 * @param {number} [opt_options.zIndex = 1] The world's zIndex.
 * @param {number} [opt_options.colorMode = 'rgba'] The world's colorMode. Valid values are 'rgba' and 'hsla'.
 *   If Modernizr detects that the browser does not support alpha channels, the world's opacity property
 *   will be used for opacity.
 * @param {Array|string} [opt_options.backgroundColor = 'transparent'] The world's color. If colorMode = 'rgba',
 *   pass in an array formatted as [red, green, blue, alpha]. If colorMode = 'hsla', this property will
 *   be ignored.
 * @param {number} [opt_options.hue = 0] The world's hue. Used if colorMode = 'hsla'.
 * @param {number} [opt_options.saturation = 1] The world's saturation. Used if colorMode = 'hsla'.
 * @param {number} [opt_options.lightness = 0.5] The world's lightness. Used if colorMode = 'hsla'.
 * @param {string} [opt_options.addMenuText = ''] If the world's menu is activated, this text is appended.
 * @param {boolean} [opt_options.noMenu = undefined] If true, the world does not display a menu.
 *
 * @constructor
 */
function World(opt_el, opt_options) {

  var el, options = opt_options || {},
      viewportSize = exports.Utils.getWindowSize();

  this.gravity = options.gravity || new exports.Vector(0, 0.01);
  this.c = options.c || 0.1;
  this.resolution = options.resolution || 4;
  this.width = options.width / this.resolution || viewportSize.width / this.resolution;
  this.height = options.height / this.resolution || viewportSize.height / this.resolution;
  this.borderRadius = options.borderRadius || 0;
  this.location = options.location || new Vector(((viewportSize.width - (this.width * this.resolution)) / 2),
      ((viewportSize.height - (this.height * this.resolution)) / 2));
  this.opacity = typeof options.opacity === 'undefined' ? 1 : options.opacity;
  this.zIndex = typeof options.zIndex === 'undefined' ? 1 : options.zIndex;
  this.colorMode = options.colorMode || 'rgba';
  this.backgroundColor = options.backgroundColor || 'transparent';
  this.hue = options.hue || 0;
  this.saturation = typeof options.saturation === 'undefined' ? 1 : options.saturation;
  this.lightness = typeof options.lightness === 'undefined' ? 0.5 : options.lightness;
  this.addMenuText = typeof options.addMenuText === 'undefined' ? '' : options.addMenuText;

  // if no element is passed, use document.body
  if (!opt_el) {
    el = document.body;
  } else {
    el = opt_el;
  }

  this.el = el;
  this.name = 'World';
  this.el.className = this.name.toLowerCase();
  this.id = this.name + exports.System.getNewId();
  this.pauseStep = false;

  // create container if not document.body
  if (el !== document.body) {
    var container = document.createElement('div'),
        style = container.style;

    container.id = 'container_' + this.name.toLowerCase();
    container.className = 'worldContainer';
    style.left = this.location.x + 'px';
    style.top = this.location.y + 'px';
    style.width = this.width * this.resolution + 'px';
    style.height = this.height * this.resolution + 'px';
    style.zIndex = this.zIndex;
    style.backgroundColor = this.colorMode === 'rgba' ?
        'rgba(' + this.backgroundColor[0] + ', ' + this.backgroundColor[1] + ', ' + this.backgroundColor[2] + ', ' + this.opacity + ')' :
        'hsla(' + this.hue + ', ' + (this.saturation * 100) + '%, ' + (this.lightness * 100) + '%, ' + this.opacity + ')';
    container.appendChild(this.el);

    if (!options.noMenu) {
      this.menu = document.createElement('div');
      this.menu.id = 'inputMenu';
      this.menu.className = 'inputMenu';
      var menuText = "'p' = pause | 'r' = reset | 's' = stats | 'h' = hide " + this.addMenuText;
      this.menu.textContent = menuText;
      container.appendChild(this.menu);
      this.menuHidden = false;
    }
    
    document.body.appendChild(container);
    
  }

  /**
   * Object pool used to recycle objects.
   * @private
   */
  this._pool = [];

  /**
   * Worlds do not have worlds. However, assigning an
   * object literal makes for less conditions in the
   * update loop.
   */
  this.world = {};
}

World.prototype.toggleMenu = function() {
  this.menuHidden = !this.menuHidden;
  if (this.menuHidden) {
    this.menu.style.visibility = 'hidden';
    return;
  }
  this.menu.style.visibility = 'visible';
};
