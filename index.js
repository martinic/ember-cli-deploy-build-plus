/* jshint node: true */
'use strict';

var Promise = require('ember-cli/lib/ext/promise');
var glob  = require('glob');
var DeployPluginBase = require('ember-cli-deploy-plugin');
var path = require('path');
var Funnel = require('broccoli-funnel');
var stew = require('broccoli-stew');
var fs = require('fs');
var chalk = require('chalk');

function cleanupRobotsTxt(outputPath) {
  var files = glob.sync(outputPath + path.sep + 'robots-*.txt');
  if (files && files.length) {
    files.forEach(function(path) {
      fs.unlink(path);
    });
  }
}

module.exports = {
  name: 'ember-cli-deploy-build-plus',

  // Cleanup env specific robots.txt
  postBuild: function(result) {
    cleanupRobotsTxt(result.directory);
  },

  // Pick env specific robots.txt
  treeForPublic: function() {
    var appEnv = this.app.env;
    var publicFiles = new Funnel(this.app.trees.public);

    this._requireBuildPackages();

    fs.stat(
      path.join(this.project.root, 'public', 'robots.txt'),
      function(err, stats) {
        if (stats && stats.isFile()) {
          console.log(chalk.yellow('There is a robots.txt in /public and ENV specific robots.txt are ignored!'));
        }
      }
    );

    publicFiles = stew.rename(
      publicFiles,
      'robots-' + appEnv + '.txt',
      'robots.txt'
    );

    return new Funnel(publicFiles, {
      srcDir: '/',
      destDir: '/'
    });
  },

  createDeployPlugin: function(options) {
    var DeployPlugin = DeployPluginBase.extend({
      name: options.name,
      defaultConfig: {
        environment: 'production',
        outputPath: 'tmp' + path.sep + 'deploy-dist',
        distDir: function(context) {
          return context.distDir;
        }
      },

      setup: function() {
        var outputPath = this.readConfig('outputPath');
        return {
          distDir: outputPath
        };
      },

      build: function(/* context */) {
        var self       = this;
        var distDir    = this.readConfig('distDir');
        var buildEnv   = this.readConfig('environment');

        var Builder  = this.project.require('ember-cli/lib/models/builder');
        var builder = new Builder({
          ui: this.ui,
          outputPath: distDir,
          environment: buildEnv,
          project: this.project
        });

        this.log('building app to `' + distDir + '` using buildEnv `' + buildEnv + '`...', { verbose: true });
        return builder.build()
          .finally(function() {
            return builder.cleanup();
          })
          .then(this._cleanupRobotsTxt.bind(this, distDir))
          .then(this._logSuccess.bind(this, distDir))
          .then(function(files) {
            files = files || [];

            return {
              distFiles: files
            };
          })
          .catch(function(error) {
            self.log('build failed', { color: 'red' });
            return Promise.reject(error);
          });
      },
      _cleanupRobotsTxt: function(outputPath) {
        cleanupRobotsTxt(outputPath);

        return outputPath;
      },
      _logSuccess: function(outputPath) {
        var self = this;
        var files = glob.sync('**/**/*', { nonull: false, nodir: true, cwd: outputPath });

        if (files && files.length) {
          files.forEach(function(path) {
            self.log('✔  ' + path, { verbose: true });
          });
        }
        self.log('build ok', { verbose: true });

        return Promise.resolve(files);
      }
    });
    return new DeployPlugin();
  }
};
