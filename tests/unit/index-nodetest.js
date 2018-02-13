/* eslint-env node */
'use strict';

var assert  = require('ember-cli-internal-test-helpers/lib/helpers/assert');
var baseSubject = require('../../index');
var path = require('path');
var Project  = require('ember-cli/lib/models/project');

describe('build plugin', function() {
  var subject, mockUi, config;

  beforeEach(function() {
    subject = baseSubject;
    mockUi = {
      messages: [],
      verbose: true,
      startProgress: function() { },
      write: function() { },
      writeLine: function(message) {
        this.messages.push(message);
      },
      writeError: function(message) {
        this.messages.push(message);
      },
      writeDeprecateLine: function(message) {
        this.messages.push(message);
      },
      writeWarnLine: function(message) {
        this.messages.push(message);
      }
    };
  });

  it('has a name', function() {
    var plugin = subject.createDeployPlugin({
      name: 'test-plugin'
    });

    assert.equal(plugin.name, 'test-plugin');
  });

  it('implements the correct hooks', function() {
    var plugin = subject.createDeployPlugin({
      name: 'test-plugin'
    });

    assert.equal(typeof plugin.configure, 'function');
    assert.equal(typeof plugin.build, 'function');
  });

  describe('configure hook', function() {
    var plugin, context;
    describe('without providing config', function () {
      beforeEach(function() {
        config = { };
        plugin = subject.createDeployPlugin({
          name: 'build'
        });
        context = {
          ui: mockUi,
          config: config
        };
        plugin.beforeHook(context);
      });
      it('warns about missing optional config', function() {
        plugin.configure(context);
        var messages = mockUi.messages.reduce(function(previous, current) {
          if (/- Missing config:\s.*, using default:\s/.test(current)) {
            previous.push(current);
          }

          return previous;
        }, []);
        assert.equal(messages.length, 3);
      });

      it('adds default config to the config object', function() {
        plugin.configure(context);
        assert.isDefined(config.build.environment);
        assert.isDefined(config.build.outputPath);
      });
    });

    describe('with a build environment and outputPath provided', function () {
      beforeEach(function() {
        config = {
          build: {
            environment: 'development',
            outputPath: 'tmp/dist-deploy',
            distDir: function(context) {
              return context.distDir;
            }
          }
        };
        plugin = subject.createDeployPlugin({
          name: 'build'
        });
        context = {
          ui: mockUi,
          config: config
        };
        plugin.beforeHook(context);
      });
      it('does not warn about missing optional config', function() {
        plugin.configure(context);
        var messages = mockUi.messages.reduce(function(previous, current) {
          if (/- Missing config:\s.*, using default:\s/.test(current)) {
            previous.push(current);
          }

          return previous;
        }, []);
        assert.equal(messages.length, 0);
      });
    });
  });

  describe('setup hook', function() {
    var plugin, context;

    beforeEach(function() {
      plugin = subject.createDeployPlugin({
        name: 'build'
      });

      context = {
        ui: mockUi,
        project: {
          name: function() { return 'test-project'; },
          require: function(mod) { return require(mod); },
          addons: [],
          root: 'tests/dummy'
        },
        config: {
          build: {
            buildEnv: 'development',
            outputPath: 'tmp/dist-deploy'
          }
        }
      };
      plugin.beforeHook(context);
    });

    it('resolves with distDir', function() {
      assert.deepEqual(plugin.setup(context), {
        distDir: 'tmp/dist-deploy'
      });
    });
  });

  describe('build hook', function() {
    var plugin, context;

    beforeEach(function() {
      plugin = subject.createDeployPlugin({
        name: 'build'
      });

      var mockCli = {
        root: path.resolve(__dirname, '..')
      };

      context = {
        ui: mockUi,
        project: Project.projectOrnullProject(mockUi, mockCli),
        config: {
          build: {
            buildEnv: 'development',
            distDir: 'tmp/dist-deploy',
          }
        }
      };

      plugin.beforeHook(context);
    });

    it('builds the app and resolves with distFiles', function(done) {
      this.timeout(50000);
      var MockProcess = require('ember-cli/tests/helpers/mock-process');
      var MockProject = require('ember-cli/tests/helpers/mock-project');

      context.project = new MockProject();
      context.project.require = function(mod) { return require(mod); };

      var willInterruptProcess = require('ember-cli/lib/utilities/will-interrupt-process');
      var _process = new MockProcess();
      willInterruptProcess.capture(_process);

      return assert.isFulfilled(plugin.build(context))
        .then(function(result) {
          assert.deepEqual(result, {
            distFiles: [
               'assets/dummy.css',
               'assets/dummy.js',
               'assets/dummy.map',
               'assets/test-support.css',
               'assets/test-support.js',
               'assets/test-support.map',
               'assets/tests.js',
               'assets/tests.map',
               'assets/vendor.css',
               'assets/vendor.js',
               'assets/vendor.map',
               'crossdomain.xml',
               'index.html',
               'robots.txt',
               'testem.js',
               'tests/index.html'
            ]
          });
          done();
        }).catch(function(reason){
          // eslint-disable-next-line no-console
          console.log(reason.actual.stack);
          done(reason.actual);
        });
    });
  });
});
