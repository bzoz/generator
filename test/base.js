/*global describe, before, beforeEach, after, afterEach, it */
'use strict';
var fs = require('fs');
var path = require('path');
var util = require('util');
var events = require('events');
var assert = require('assert');
var sinon = require('sinon');
var generators = require('..');
var helpers = require('../lib/test/helpers');
var _ = require('lodash');

var Base = generators.generators.Base;

describe('yeoman.generators.Base', function () {
  // TODO(mklabs): generate generator about to be tested, or add it in fixtures.

  before(generators.test.before(path.join(__dirname, 'temp.dev')));

  beforeEach(function () {
    var env = this.env = generators();

    var Dummy = generators.test.createDummyGenerator();

    env.registerStub(Dummy, 'ember:all');
    env.registerStub(Dummy, 'hook1:ember');
    env.registerStub(Dummy, 'hook2:ember:all');
    env.registerStub(Dummy, 'hook3');
    env.registerStub(function () {
      this.write(path.join(__dirname, 'temp.dev/app/scripts/models/application-model.js'), '// ...');
    }, 'hook4');

    this.Dummy = Dummy;
    this.dummy = new Dummy(['bar', 'baz', 'bom'], {
      foo: false,
      something: 'else',
      // mandatory options, created by the env#create() helper
      resolved: 'ember:all',
      namespace: 'dummy',
      env: env,
    });

    this.dummy
      .hookFor('hook1')
      .hookFor('hook2')
      .hookFor('hook3')
      .hookFor('hook4');
  });

  describe('generator.appname', function () {
    it('should be set with the project directory name without non-alphanums', function () {
      process.chdir(path.join(__dirname, 'temp.dev'));
      assert.equal(this.dummy.appname, 'temp dev');
    });
  });

  describe('.extend', function () {
    it('create a new object inheriting the Generator', function () {
      assert.equal(Base.extend().prototype.constructor, Base);
    });

    it('pass the extend method along', function () {
      var Sub = Base.extend();
      assert.ok(Sub.extend);
    });

    it('assign prototype methods', function () {
      var proto = { foo: function () {}};
      var Sub = Base.extend(proto);
      assert.equal(Sub.prototype.foo, proto.foo);
    });

    it('assign static methods', function () {
      var staticProps = { foo: function () {}};
      var Sub = Base.extend({}, staticProps);
      assert.equal(Sub.foo, staticProps.foo);
    });
  });

  describe('#run', function () {
    beforeEach(function () {
      this.TestGenerator = generators.test.createDummyGenerator();
      this.TestGenerator.prototype.foo = sinon.spy();
      this.testGen = new this.TestGenerator([], {
        resolved: 'ember:all',
        namespace: 'dummy',
        env: this.env
      });
      this.testGen.foo = sinon.spy();
    });

    it('run all methods in the given generator', function (done) {
      this.testGen.run(done);
    });

    it('turn on _running flag', function () {
      this.testGen.run();
      assert.ok(this.testGen._running);
    });

    it('run prototype methods', function (done) {
      this.testGen.run(function () {
        assert.ok(this.TestGenerator.prototype.foo.calledOnce);
        assert.equal(this.testGen.foo.callCount, 0);
        done();
      }.bind(this));
    });
  });

  // Underscore String

  // > http://epeli.github.com/underscore.string/
  // > https://github.com/epeli/underscore.string#string-functions
  //
  // Underscore String set of utilities are very handy, especially in the
  // context of Generators. We often want to humanize, dasherize or underscore
  // a given variable.
  //
  // Since templates are invoked in the context of the Generator that render
  // them, all these String helpers are then available directly from templates.
  describe('Underscore String', function () {
    it('has the whole Underscore String API available as prototype method', function () {
      var dummy = new generators.Base([], {
        env: generators(),
        resolved: __filename
      });
      var str = require('underscore.string').exports();

      Object.keys(str).forEach(function (prop) {
        if (typeof str[prop] !== 'function') {
          return;
        }
        assert.equal(typeof dummy._[prop], 'function');
      }, this);
    });
  });

  describe('generator.run(args, cb) regression', function () {
    var events = [];
    var resolveCalled = 0;
    var resolveExpected = 0;

    before(function () {
      var Unicorn = function () {
        generators.Base.apply(this, arguments);
      };

      util.inherits(Unicorn, generators.Base);

      Unicorn.prototype.test1 = function () {
        this.async()();
      };

      Unicorn.prototype.test2 = function () {
        // Nothing
      };

      Unicorn.prototype.test3 = function () {
        this.async()('mostlyn\'t');
      };

      Unicorn.prototype.test4 = function () {
        // Nothing again
      };

      this.unicorn = helpers.createGenerator('unicorn:app', [
        [Unicorn, 'unicorn:app']
      ]);

      helpers.stub(this.unicorn, 'emit', function (type, err) {
        events.push({
          type: type,
          err: err
        });

        if (type === 'method') {
          resolveExpected++;
        }
      });

      helpers.decorate(this.unicorn.conflicter, 'resolve', function () {
        resolveCalled++;
      });
    });

    after(helpers.restore);

    afterEach(function () {
      events = [];
      resolveCalled = 0;
      resolveExpected = 0;
    });

    it('should call `done` only once', function (done) {
      // Mocha will fail if done was called more than once.
      this.unicorn.run({}, done);
    });

    it('should emit an error from async', function (done) {
      this.unicorn.run({}, function () {
        assert.ok(JSON.stringify(events).indexOf('{"type":"error","err":"mostlyn\'t"}') > -1);
        done();
      });
    });

    it('should resolve conflicts after each method is invoked', function (done) {
      this.unicorn.run({}, function () {
        assert.equal(resolveCalled, resolveExpected);
        done();
      });
    });
  });

  describe('generator.runHooks(cb)', function () {
    it('should go through all registered hooks, and invoke them in series', function (done) {
      process.chdir(path.join(__dirname, 'temp.dev'));
      this.dummy.runHooks(function (err) {
        if (err) {
          return err;
        }
        fs.stat('app/scripts/models/application-model.js', done);
      });
    });
  });

  describe('generator.argument(name, config)', function () {
    it('should add a new argument to the generator instance', function () {
      assert.equal(this.dummy._arguments.length, 0);
      this.dummy.argument('foo');
      assert.equal(this.dummy._arguments.length, 1);
    });

    it('should create the property specified with value from positional args', function () {
      this.dummy.argument('foo');
      assert.equal(this.dummy.foo, 'bar');
    });

    it('should slice positional arguments when config.type is Array', function () {
      this.dummy.argument('bar', {
        type: Array
      });

      assert.deepEqual(this.dummy.bar, ['bar', 'baz', 'bom']);
    });

    it('should raise an error if required arguments are not provided', function (done) {
      var dummy = new generators.Base([], {
        env: this.env,
        resolved: 'dummy:all'
      }).on('error', function (ev) {
        done();
      });

      dummy.argument('foo', {
        required: true
      });
    });

    it('should not raise an error if required arguments are not provided, but the help option has been specified', function () {
      var dummy = new generators.Base([], {
        env: this.env,
        resolved: 'dummy:all'
      });

      dummy.options.help = true;

      assert.equal(dummy._arguments.length, 0);

      assert.doesNotThrow(dummy.argument.bind(dummy, 'foo', { required: true }));

      assert.equal(dummy._arguments.length, 1);
    });
  });

  describe('generator.option(name, config)', function () {
    it('should add a new option to the set of generator expected options', function () {
      // every generator have the --help options
      var generator = new this.Dummy([], {
        env: this.env,
        resolved: 'test'
      });

      assert.equal(generator._options.length, 1);
      generator.option('foo');
      assert.equal(generator._options.length, 2);
      assert.deepEqual(generator._options.pop(), {
        desc: 'Description for foo',
        name: 'foo',
        type: Boolean,
        defaults: false,
        hide: false
      });
    });
  });

  describe('generator.hookFor(name, config)', function () {
    it('should emit errors if called when running', function () {
      try {
        this.dummy.hookFor('maoow');
      } catch (err) {
        assert.equal(err.message, 'hookFor must be used within the constructor only');
      }
    });

    it('should create the macthing option', function () {
      this.dummy._running = false;
      this.dummy.hookFor('something');
      assert.deepEqual(this.dummy._options.pop(), {
        desc: 'Something to be invoked',
        name: 'something',
        type: Boolean,
        defaults: 'else',
        hide: false
      });
    });

    it('should update the internal hooks holder', function () {
      this.dummy.hookFor('something');
      assert.deepEqual(this.dummy._hooks.pop(), { name: 'something' });
    });
  });

  describe('generator.defaultFor(config)', function () {
    it('should return the value for the option name, doing lookup in options and Grunt config', function () {
      var name = this.dummy.defaultFor('something');
      assert.equal(name, 'else');
    });
  });

  describe('generator.desc(decription)', function () {
    it('should update the internal description', function () {
      this.dummy.desc('A new desc for this generator');
      assert.equal(this.dummy.description, 'A new desc for this generator');
    });
  });

  describe('generator.help()', function () {
    it('should return the expected help / usage output', function () {
      this.dummy.option('ooOoo');
      this.dummy.argument('baz', {
        type: Number,
        required: false
      });
      this.dummy.desc('A new desc for this generator');
      var help = this.dummy.help();

      assert.ok(help.match('Usage:'));
      assert.ok(help.match('yo dummy \\[options\\] \\[<baz>\\]'));
      assert.ok(help.match('A new desc for this generator'));
      assert.ok(help.match('Options:'));
      assert.ok(help.match('--help   # Print generator\'s options and usage'));
      assert.ok(help.match('--ooOoo  # Description for ooOoo'));
      assert.ok(help.match('Arguments:'));
      assert.ok(help.match('baz  # Type: Number  Required: false'));
    });
  });

  describe('generator.usage()', function () {
    it('should return the expected help / usage output with arguments', function () {
      this.dummy.argument('baz', {
        type: Number,
        required: false
      });
      var usage = this.dummy.usage();
      assert.equal(usage.trim(), 'yo dummy [options] [<baz>]');
    });

    it('should return the expected help / usage output without arguments', function () {
      this.dummy._arguments.length = 0;
      var usage = this.dummy.usage();
      assert.equal(usage.trim(), 'yo dummy [options]');
    });

    it('should return the expected help / usage output without options', function () {
      this.dummy._arguments.length = 0;
      this.dummy._options.length = 0;
      var usage = this.dummy.usage();
      assert.equal(usage.trim(), 'yo dummy');
    });
  });

  describe('generator.shell', function () {
    it('should extend shelljs module', function () {
      _.each(require('shelljs'), function (method, name) {
        assert.equal(method, generators.Base.prototype.shell[name]);
      });
    });
  });

  describe('generator.storage()', function () {
    it('should provide a storage instance', function () {
      assert.ok(this.dummy.config instanceof require('../lib/util/storage'));
    });

    it('should set the CWD where `.yo-rc.json` is found', function () {
      var projectDir = path.join(__dirname, 'fixtures/dummy-project');
      process.chdir(path.join(projectDir, 'subdir'));
      var dummy = new this.Dummy(['foo'], {
        resolved: 'ember:all',
        env: this.env
      });
      assert.equal(process.cwd(), projectDir);
    });

    it('should update storage when destinationRoot change', function () {
      sinon.spy(this.Dummy.prototype, '_setStorage');
      this.dummy.destinationRoot('foo');
      assert.equal(this.Dummy.prototype._setStorage.callCount, 1);
      this.dummy.destinationRoot();
      assert.equal(this.Dummy.prototype._setStorage.callCount, 1);
      this.dummy.destinationRoot('foo');
      assert.equal(this.Dummy.prototype._setStorage.callCount, 2);
      this.Dummy.prototype._setStorage.restore();
    });
  });

});
