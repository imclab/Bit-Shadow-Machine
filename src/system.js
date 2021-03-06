/*global window, document, setTimeout, Burner, Modernizr, console */
/*jshint supernew:true */
/** @namespace */
var System = {
  name: 'System'
};

/**
 * Increments each time update() is executed.
 */
System.clock = 0;

/**
 * A map of supported browser features. By default
 * we're assuming support for boxShadows, rgba, and hsla.
 */
System.supportedFeatures = {
  boxshadow: true,
  rgba: true,
  hsla: true
};

/**
 * Stores references to all items in the system.
 * @private
 */
System._records = {
  lookup: {},
  list: []
};

/**
 * Stores references to all worlds in the system.
 * @private
 */
System._worlds = {
  lookup: {},
  list: [],
  buffers: {}
};

/**
 * Stores references to all items in the system.
 * @private
 */
System._caches = {};

/**
 * Used to create unique ids.
 * @private
 */
System._idCount = 0;

/**
 * Holds the current and last mouse/touch positions relative
 * to the browser window. Also, holds the current mouse velocity.
 * @public
 */
System.mouse = {
  location: new Vector(),
  lastLocation: new Vector(),
  velocity: new Vector()
};

/**
 * Stores the time in milliseconds of the last
 * resize event. Used to pause renderer during resize
 * and resume when resize is complete.
 * @type number
 * @private
 */
System._resizeTime = 0;

/**
 * Set to true log flags in a performance tracing tool.
 * @type boolean
 */
System.trace = false;

/**
 * Set to a positive number to render only those frames. Leave at
 * -1 to ignore.
 * @type number
 */
System.totalFrames = -1;

/**
 * Set to true to save properties defined in System.recordItemProperties from
 * each object in each frame.
 * @type boolean
 */
System.recordData = false;

/**
 * Recording starts with this frame number.
 * @type number
 */
System.recordStartFrame = null;

/**
 * Recording ends with this frame number.
 * @type number
 */
System.recordEndFrame = null;

/**
 * Defines the properties to save in System.recordedData for each item
 * in each frame.
 * @type Object
 */
System.recordItemProperties = {
  id: true,
  name: true,
  width: true,
  height: true,
  scale: true,
  location: true,
  velocity: true,
  angle: true,
  minSpeed: true,
  maxSpeed: true,
  hue: true,
  saturation: true,
  lightness: true,
  color: true,
  opacity: true
};

/**
 * Defines the properties to save in System.recordedData for each world
 * in each frame.
 * @type Object
 */
System.recordWorldProperties = {
  id: true,
  name: true,
  width: true,
  height: true,
  resolution: true,
  colorMode: true
};

/**
 * Stores properties from each object in each frame.
 * @type Array
 * @example
 [
    {
      frame: 0,
      items: [
        {},
        {},
        ...
      ]
    }
 ]
 */
System.recordedData = [];

/**
 * Initializes the system and starts the update loop.
 *
 * @function init
 * @memberof System
 * @param {Function=} opt_setup Creates the initial system conditions.
 * @param {Object=} opt_worlds A reference to a DOM element representing the System world.
 * @param {Object=} opt_supportedFeatures A map of supported browser features.
 * @param {boolean=} opt_noStartLoop If true, _update is not called. Use to setup a System
 *    and start the _update loop at a later time.
 */
System.init = function(opt_setup, opt_worlds, opt_supportedFeatures, opt_noStartLoop) {

  var setup = opt_setup || function () {},
      worlds = opt_worlds || new exports.World(document.body),
      supportedFeatures = opt_supportedFeatures || System.supportedFeatures,
      noStartLoop = !opt_noStartLoop ? false : true;

  // halt execution if the browser does not support box shadows
  if (!supportedFeatures.boxshadow) {
    throw new Error('BitShadowMachine requires support for CSS Box Shadows.');
  }

  this.supportedFeatures = supportedFeatures;

  if (Object.prototype.toString.call(worlds) === '[object Array]') {
    for (var i = 0, max = worlds.length; i < max; i++) {
      System._addWorld(worlds[i]);
    }
  } else {
    System._addWorld(worlds);
  }

  document.body.onorientationchange = System.updateOrientation;

  // listen for resize events
  exports.Utils.addEvent(window, 'resize', function(e) {
    System._resize.call(System, e);
  });

  // save the current and last mouse position
  exports.Utils.addEvent(document, 'mousemove', function(e) {
    System._recordMouseLoc.call(System, e);
  });

  // save the current and last touch position
  exports.Utils.addEvent(window, 'touchstart', function(e) {
    System._recordMouseLoc.call(System, e);
  });
  exports.Utils.addEvent(window, 'touchmove', function(e) {
    System._recordMouseLoc.call(System, e);
  });
  exports.Utils.addEvent(window, 'touchend', function(e) {
    System._recordMouseLoc.call(System, e);
  });

  // listen for device motion events (ie. accelerometer)
  exports.Utils.addEvent(window, 'devicemotion', function(e) {

    var world, worlds = System._caches.World.list,
        x = e.accelerationIncludingGravity.x,
        y = e.accelerationIncludingGravity.y;

    for (i = 0, max = worlds.length; i < max; i++) {
      world = worlds[i];
      if (window.orientation === 0) {
        world.gravity.x = x;
        world.gravity.y = y * -1;
      } else if (window.orientation === -90) {
        world.gravity.x = y;
        world.gravity.y = x;
      } else {
        world.gravity.x = y * -1;
        world.gravity.y = x * -1;
      }
    }
  });

  // listen for key up
  exports.Utils.addEvent(window, 'keyup', function(e) {
    System._keyup.call(System, e);
  });

  this._setup = setup;
  this._setup.call(this);

  if (!noStartLoop) {
    this._update();
  }
};

/**
 * Adds world to System records and worlds cache.
 *
 * @function _addWorld
 * @memberof System
 * @private
 * @param {Object} world A world.
 */
System._addWorld = function(world) {
  System._records.list.push(world);
  System._worlds.list.push(System._records.list[System._records.list.length - 1]);
  System._worlds.lookup[world.id] = System._records.list[System._records.list.length - 1];
  System._worlds.buffers[world.id] = '';
};

/**
 * Adds an item to the system.
 *
 * @function add
 * @memberof System
 * @param {string} klass Function will try to create an instance of this class.
 * @param {Object=} opt_options Object properties.
 * @param {string=} opt_world The world to contain the item.
 */
System.add = function(klass, opt_options, opt_world) {

  var options = opt_options || {},
      records = this._records.list,
      i, max, item, pool;

  options.world = opt_world || records[0];

  // recycle object if one is available
  pool = this.getAllItemsByName(klass, options.world._pool);

  if (pool.length) {
    for (i = 0, max = options.world._pool.length; i < max; i++) {
      if (options.world._pool[i].name === klass) {
        item = options.world._pool.splice(i, 1)[0];
        break;
      }
    }
  } else {
    if (BitShadowMachine[klass]) {
      item = new BitShadowMachine[klass](options);
    } else {
      item = new BitShadowMachine.Classes[klass](options);
    }
  }
  item.reset(options);
  item.init(options);
  System._records.list.push(item);
  return item;
};

/**
 * Starts the render loop.
 * @function start
 * @memberof System
 */
System.start = function() {
  this._update();
};

/**
 * Adds an object to a cache based on its constructor name.
 *
 * @function updateCache
 * @memberof System
 * @param {Object} obj An object.
 * returns {Object} The cache that received the passed object.
 */
System.updateCache = function(obj) {

  // Create cache object, unless it already exists
  var cache = System._caches[obj.name] ||
      (System._caches[obj.name] = {
        lookup: {},
        list: []
      });

  cache.list[cache.list.length] = obj;
  cache.lookup[obj.id] = true;
  return cache;
};

/**
 * Assigns the given 'val' to the given object's record in System._caches.
 *
 * @function _updateCacheLookup
 * @memberof System
 * @private
 * @param {Object} obj An object.
 * @param {Boolean} val True if object is active, false if object is destroyed.
 */
System._updateCacheLookup = function(obj, val) {

  var cache = System._caches[obj.name];

  if (cache) {
    cache.lookup[obj.id] = val;
  }
};

/**
 * Returns the total number of items in the system.
 *
 * @function count
 * @memberof System
 * @returns {number} Total number of items.
 */
System.count = function() {
  return this._records.list.length;
};

/**
 * Returns the first world in the system.
 *
 * @function firstWorld
 * @memberof System
 * @returns {null|Object} A world.
 */
System.firstWorld = function() {
  return this._worlds.list.length ? this._worlds.list[0] : null;
};

/**
 * Returns the last world in the system.
 *
 * @function lastWorld
 * @memberof System
 * @returns {null|Object} A world.
 */
System.lastWorld = function() {
  return this._worlds.list.length ? this._worlds.list[this._worlds.list.length - 1] : null;
};

/**
 * Returns the first item in the system.
 *
 * @function firstItem
 * @memberof System
 * @returns {Object} An item.
 */
System.firstItem = function() {
  return this._records.list[0];
};

/**
 * Returns the last item in the system.
 *
 * @function lastItem
 * @memberof System
 * @returns {Object} An item.
 */
System.lastItem = function() {
  return this._records.list[this._records.list.length - 1];
};

/**
 * Returns all worlds.
 *
 * @function getAllWorlds
 * @memberof System
 * @return {Array.<World>} An array of worlds.
 */
System.getAllWorlds = function() {
  return System._worlds.list;
};

/**
 * Returns all buffers.
 *
 * @function getAllBuffers
 * @memberof System
 * @return {Array.<Buffer>} An array of buffers.
 */
System.getAllBuffers = function() {
  return System._worlds.buffers;
};

/**
 * Iterates over objects in the system and calls step() and draw().
 *
 * @function _update
 * @memberof System
 * @private
 */
System._update = function() {

  var i, max, style, records = System._records.list, record,
      worlds = System.getAllWorlds(),
      world = System.firstWorld(),
      buffers = System.getAllBuffers(), buffer,
      shadows = '';

  // check for resize stop
  if (System._resizeTime && new Date().getTime() - System._resizeTime > 100) {
    System._resizeTime = 0;
    for (i = 0, max = worlds.length; i < max; i++) {
      worlds[i].pauseStep = false;
    }
    if (world.afterResize) {
      world.afterResize.call(this);
    }
  }

  // check if we've exceeded totalFrames
  if (System.totalFrames > -1 && System.clock >= System.totalFrames) {
    System.totalFramesCallback();
    return;
  }

  if (System.trace) {
    console.time('update');
  }

  // setup entry in System.recordedData
  if (System.recordData) {
    System.recordedData = [{
      frame: System.clock,
      world: {},
      items: []
    }];
  }

  // step
  for (i = records.length - 1; i >= 0; i -= 1) {
    record = records[i];
    if (record.step && !record.world.pauseStep) {
      record.step();
    }
    if (System.recordData && record.name !== 'World' && record.opacity) { // we don't want to record World data as Item
      if (!System._checkRecordFrame()) {
        continue;
      }
      System.recordedData[System.recordedData.length - 1].items.push({});
      System._saveData(System.recordedData[System.recordedData.length - 1].items.length - 1, record);
    }
  }

  if (System.trace) {
    console.timeEnd('update');
    console.time('render');
  }

  // draw

  // loop thru records and build box shadows
  for (i = records.length - 1; i >= 0; i -= 1) {
    record = records[i];
    if (record.world && record.location && record.opacity && !(record instanceof exports.World)) {

      shadows = buffers[record.world.id];

      if (record.world.colorMode === 'rgba' && record.color) {
        shadows = shadows + System._buildStringRGBA(record);
      } else if (record.world.colorMode === 'hsla' && typeof record.hue !== 'undefined' &&
          typeof record.saturation !== 'undefined' && typeof record.lightness !== 'undefined') {
        shadows = shadows + System._buildStringHSLA(record);
      } else {
        throw new Error('System: current color mode not supported.');
      }
      buffers[record.world.id] = shadows;
    }
  }

  // loop thru worlds and apply box shadow
  for (i = worlds.length - 1; i >= 0; i -= 1) {
    world = worlds[i];
    style = world.el.style;
    buffer = buffers[world.id];
    buffers[worlds[i].id] = ''; // clear buffer
    style.boxShadow = buffer.substr(0, buffer.length - 1); // remove the last comma
    style.borderRadius = world.borderRadius + '%';
  }


  if (System.trace) {
    console.timeEnd('render');
  }

  // check to call frame complete callback.
  if (System.totalFrames > -1 && System._checkRecordFrame()) {
    System.frameCompleteCallback(System.clock, System.recordedData[0]);
    System.recordedData = null;
  }

  System.clock++;

  window.requestAnimFrame(System._update);
};

/**
 * Called if System.totalFrames > -1 and exceeds System.clock.
 */
System.frameCompleteCallback = function(frameNumber, data) {
  if (console) {
    console.log('Rendered frame ' + frameNumber + '.');
  }
};

/**
 * Called if System.totalFrames > -1 and exceeds System.clock.
 */
System.totalFramesCallback = function() {
  if (console) {
    console.log('Rendered ' + System.totalFrames + ' frames.');
  }
};

/**
 * Builds an hsla box shadow string based on the passed
 * object's properties.
 * @private
 */
System._buildStringHSLA = function(item) {

    var resolution = item.world.resolution,
        loc = item.location;

    return (loc.x * resolution) + 'px ' + // left offset
        (loc.y * resolution) + 'px ' + // right offset
        item.blur + 'px ' + // blur
        (resolution * item.scale) + 'px ' + // spread
        (System.supportedFeatures.hsla ? item.world.colorMode : 'hsl') + // color mode
        '(' + item.hue + ',' + (item.saturation * 100) + '%,' + (item.lightness * 100) + '%' + // color
        (System.supportedFeatures.hsla ? ', ' + item.opacity : '') + '),'; // opacity
};

/**
 * Builds an rgba box shadow string based on the passed
 * object's properties.
 * @private
 */
System._buildStringRGBA = function(item) {

    var resolution = item.world.resolution,
        loc = item.location;

    return (loc.x * resolution) + 'px ' + // left offset
        (loc.y * resolution) + 'px ' + // right offset
        item.blur + 'px ' + // blur
        (resolution * item.scale) + 'px ' + // spread
        (System.supportedFeatures.rgba ? item.world.colorMode : 'rgb') + // color mode
        '(' + item.color[0] + ',' + item.color[1] + ',' + item.color[2] + // color
        (System.supportedFeatures.rgba ? ', ' + item.opacity : '') + '),'; // opacity
};

/**
 * Pauses the system and processes one step in records.
 *
 * @function _stepForward
 * @memberof System
 * @private
 */
System._stepForward = function() {

  var i, j, max, records = System._records.list,
      world, worlds = System.getAllWorlds();

    for (i = 0, max = worlds.length; i < max; i++) {
      world = worlds[i];
      world.pauseStep = true;
      for (j = records.length - 1; j >= 0; j -= 1) {
        if (records[j].step) {
          records[j].step();
        }
      }
      for (j = records.length - 1; j >= 0; j -= 1) {
        if (records[j].draw) {
          records[j].draw();
        }
      }
    }
  System.clock++;
};

/**
 * Saves properties of the passed record that match properties
 * defined in System.recordItemProperties.
 * @param {number} index The array index for this object.
 * @param {Object} record An Item instance.
 */
System._saveData = function(index, record) {
  for (var i in record) {
    if (record.hasOwnProperty(i) && System.recordItemProperties[i]) {
      var val = record[i];
      if (val instanceof Vector) { // we want to copy the scalar values out of the Vector
        val = {
          x: parseFloat(record[i].x.toFixed(2), 10),
          y: parseFloat(record[i].y.toFixed(2), 10)
        };
      }
      if (typeof val === 'number') {
        val = parseFloat(val.toFixed(2), 10);
      }
      System.recordedData[System.recordedData.length - 1].items[index][i] = val;
    }
    if (!System.recordedData[System.recordedData.length - 1].world.id) {
      for (var j in record.world) {
        if (record.world.hasOwnProperty(j) && System.recordWorldProperties[j]) {
          System.recordedData[System.recordedData.length - 1].world[j] = record.world[j];
        }
      }
    }
  }
};

/**
 * If recordStartFrame and recordEndFrame have been specified,
 * checks if System.clock is within bounds.
 * @returns {Boolean} True if frame should be recorded.
 */
System._checkRecordFrame = function() {
  if (System.recordStartFrame && System.recordEndFrame &&
      (System.recordStartFrame > System.clock || System.clock > System.recordEndFrame)) {
    return false;
  }
  return true;
};

/**
 * Resets the system.
 *
 * @function _resetSystem
 * @memberof System
 * @private
 * @param {boolean} opt_noRestart= Pass true to not restart the system.
 */
System._resetSystem = function(opt_noRestart) {

  var i, max, world, worlds = System.getAllWorlds();

  for (i = 0, max = worlds.length; i < max; i++) {
    world = worlds[i];
    world.pauseStep = false;
    world.pauseDraw = false;

    while(world.el.firstChild) {
      world.el.removeChild(world.el.firstChild);
    }
  }

  System._caches = {};

  System._destroyAllItems();

  System._idCount = 0;

  System.mouse = {
    location: new exports.Vector(),
    lastLocation: new exports.Vector(),
    velocity: new exports.Vector()
  };

  System._resizeTime = 0;

  if (!opt_noRestart) {
    System._setup.call(System);
  }
};

/**
 * Destroys the system.
 *
 * @function _destroySystem
 * @memberof System
 * @private
 */
System._destroySystem = function() {
  this._resetSystem(true);
  this._destroyAllWorlds();
  this.clock = 0;
  this._idCount = 0;
};

/**
 * Removes all items in all worlds.
 *
 * @function _destroyAllItems
 * @memberof System
 * @private
 */
System._destroyAllItems = function() {

  var i, items = this._records.list;

  for (i = items.length - 1; i >= 0; i--) {
    if (items[i].name !== 'World') {
      items.splice(i, 1);
    }
  }
};

/**
 * Removes all worlds.
 *
 * @function _destroyAllWorlds
 * @memberof System
 * @private
 */
System._destroyAllWorlds = function() {

  var i, item, items = this._records.list;

  for (i = items.length - 1; i >= 0; i--) {
    item = items[i];
    if (item.name === 'World') {
      var container = item.el.parentNode;
      container.parentNode.removeChild(container);
      items.splice(i, 1);
    }
  }
  this._worlds = {
    lookup: {},
    list: [],
    buffers: {}
  };
};

/**
 * Removes an item from a world.
 *
 * @function destroyItem
 * @memberof System
 * @param {Object} obj The item to remove.
 */
System.destroyItem = function (obj) {

  var i, max, records = this._records.list;

  for (i = 0, max = records.length; i < max; i++) {
    if (records[i].id === obj.id) {
      records[i].world._pool[records[i].world._pool.length] = records.splice(i, 1)[0]; // move record to pool array
      System._updateCacheLookup(obj, false);
      break;
    }
  }
};

/**
 * Returns an array of items created from the same constructor.
 *
 * @function getAllItemsByName
 * @memberof System
 * @param {string} name The 'name' property.
 * @param {Array} [opt_list = this._records] An optional list of items.
 * @returns {Array} An array of items.
 */
System.getAllItemsByName = function(name, opt_list) {

  var i, max, arr = [],
      list = opt_list || this._records.list;

  for (i = 0, max = list.length; i < max; i++) {
    if (list[i].name === name) {
      arr[arr.length] = list[i];
    }
  }
  return arr;
};

/**
 * Returns an array of items with an attribute that matches the
 * passed 'attr'. If 'opt_val' is passed, 'attr' must equal 'val'.
 *
 * @function getAllItemsByAttribute
 * @memberof System
 * @param {string} attr The property to match.
 * @param {*} [opt_val=] The 'attr' property must equal 'val'.
 * @returns {Array} An array of items.
 */
System.getAllItemsByAttribute = function(attr, opt_val) {

  var i, max, arr = [], records = this._records.list,
      val = typeof opt_val !== 'undefined' ? opt_val : null;

  for (i = 0, max = records.length; i < max; i++) {
    if (typeof records[i][attr] !== 'undefined') {
      if (val !== null && records[i][attr] !== val) {
        continue;
      }
      arr[arr.length] = records[i];
    }
  }
  return arr;
};

/**
 * Updates the properties of items created from the same constructor.
 *
 * @function updateItemPropsByName
 * @memberof System
 * @param {string} name The constructor name.
 * @param {Object} props A map of properties to update.
 * @returns {Array} An array of items.
 * @example
 * System.updateElementPropsByName('point', {
 *    color: [0, 0, 0],
 *    scale: 2
 * }); // all points will turn black and double in size
 */
System.updateItemPropsByName = function(name, props) {

  var i, max, p, arr = this.getAllItemsByName(name);

  for (i = 0, max = arr.length; i < max; i++) {
    for (p in props) {
      if (props.hasOwnProperty(p)) {
        arr[i][p] = props[p];
      }
    }
  }
  return arr;
};

/**
 * Finds an item by its 'id' and returns it.
 *
 * @function getItem
 * @memberof System
 * @param {string|number} id The item's id.
 * @returns {Object} The item.
 */
System.getItem = function(id) {

  var i, max, records = this._records.list;

  for (i = 0, max = records.length; i < max; i += 1) {
    if (records[i].id === id) {
      return records[i];
    }
  }
  return null;
};

/**
 * Updates the properties of an item.
 *
 * @function updateItem
 * @memberof System
 * @param {Object} item The item.
 * @param {Object} props A map of properties to update.
 * @returns {Object} The item.
 * @example
 * System.updateItem(myItem, {
 *    color: [0, 0, 0],
 *    scale: 2
 * }); // item will turn black and double in size
 */
System.updateItem = function(item, props) {

  for (var p in props) {
    if (props.hasOwnProperty(p)) {
      item[p] = props[p];
    }
  }
  return item;
};

/**
 * Repositions all items relative to the viewport size and resets the world bounds.
 *
 * @function _resize
 * @memberof System
 * @private
 */
System._resize = function() {

  var i, max, records = this._records.list, record,
      viewportSize = exports.Utils.getWindowSize(),
      world, worlds = System.getAllWorlds();

  for (i = 0, max = records.length; i < max; i++) {
    record = records[i];
    if (record.name !== 'World' && record.world.boundToWindow && record.location) {
      record.location.x = viewportSize.width * (record.location.x / record.world.width);
      record.location.y = viewportSize.height * (record.location.y / record.world.height);
    }
  }

  for (i = 0, max = worlds.length; i < max; i++) {
    world = worlds[i];
    if (world.boundToWindow) {
      world.bounds = [0, viewportSize.width, viewportSize.height, 0];
      world.width = viewportSize.width;
      world.height = viewportSize.height;
      world.location = new exports.Vector((viewportSize.width / 2),
        (viewportSize.height / 2));
    }
  }
};

/**
 * Handles keyup events.
 *
 * @function _keyup
 * @memberof System
 * @private
 * @param {Object} e An event.
 */
System._keyup = function(e) {

  var i, max, world, worlds = this.getAllWorlds();

  switch(e.keyCode) {
    case 39:
      System._stepForward();
      break;
    case 80: // p; pause/play
      for (i = 0, max = worlds.length; i < max; i++) {
        world = worlds[i];
        world.pauseStep = !world.pauseStep;
      }
      break;
    case 82: // r; reset
      System._resetSystem();
      break;
    case 83: // s; reset
      System._toggleStats();
      break;
    case 72: // h; hide menu
      System.firstWorld().toggleMenu();
      break;
  }
};

/**
 * Increments idCount and returns the value.
 *
 * @function getNewId
 * @memberof System
 */
System.getNewId = function() {
  this._idCount++;
  return this._idCount;
};

/**
 * Saves the mouse/touch location relative to the browser window.
 *
 * @function _recordMouseLoc
 * @memberof System
 * @private
 */
System._recordMouseLoc = function(e) {

  var touch, world = this.firstWorld(), map = exports.Utils.map;

  this.mouse.lastLocation.x = this.mouse.location.x;
  this.mouse.lastLocation.y = this.mouse.location.y;

  if (e.changedTouches) {
    touch = e.changedTouches[0];
  }

  /**
   * Mapping window size to world size allows us to
   * lead an agent around a world that's not bound
   * to the window.
   */
  if (e.pageX && e.pageY) {
    this.mouse.location.x = map(e.pageX, 0, window.innerWidth, 0, world.width);
    this.mouse.location.y = map(e.pageY, 0, window.innerHeight, 0, world.height);
  } else if (e.clientX && e.clientY) {
    this.mouse.location.x = map(e.clientX, 0, window.innerWidth, 0, world.width);
    this.mouse.location.y = map(e.clientY, 0, window.innerHeight, 0, world.height);
  } else if (touch) {
    this.mouse.location.x = touch.pageX;
    this.mouse.location.y = touch.pageY;
  }

  this.mouse.velocity.x = this.mouse.lastLocation.x - this.mouse.location.x;
  this.mouse.velocity.y = this.mouse.lastLocation.y - this.mouse.location.y;
};

/**
 * Handles orientation evenst and forces the world to update its bounds.
 *
 * @function updateOrientation
 * @memberof System
 */
System.updateOrientation = function() {
  setTimeout(function() {
   System._records.list[0]._setBounds();
  }, 500);
};

/**
 * Toggles stats display.
 *
 * @function _toggleStats
 * @memberof System
 * @private
 */
System._toggleStats = function() {
  if (!System._statsDisplay) {
    System._statsDisplay = new exports.StatsDisplay();
  } else if (System._statsDisplay && System._statsDisplay._active) {
    System._statsDisplay.destroy();
  } else if (System._statsDisplay && !System._statsDisplay._active) {
    System._statsDisplay = new exports.StatsDisplay();
  }
};
