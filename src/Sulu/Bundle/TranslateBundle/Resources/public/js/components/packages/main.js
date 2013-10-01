/*
 * This file is part of the Sulu CMS.
 *
 * (c) MASSIVE ART WebServices GmbH
 *
 * This source file is subject to the MIT license that is bundled
 * with this source code in the file LICENSE.
 */

define([
    'sulutranslate/models/package',
    'sulutranslate/models/code',
    'sulutranslate/collections/catalogues',
    'sulutranslate/collections/translations'
], function(Package, Code, Catalogues, Translations) {

    'use strict';

    return {

        initialize: function() {
            this.bindCustomEvents();

            if (this.options.display === 'list') {
                this.renderList();
            } else if (this.options.display === 'details') {
                this.renderDetails();
            } else if (this.options.display === 'settings') {
                this.renderSettings();
            } else {
                throw 'display type wrong';
            }
        },

        bindCustomEvents: function() {
            // delete contact
            this.sandbox.on('sulu.translate.package.delete', function(id) {
                this.confirmDeleteDialog(function(wasConfirmed) {
                    if (wasConfirmed) {
                        var packageModel = this.getModel(id);

                        this.sandbox.emit('husky.header.button-state', 'loading-delete-button');
                        packageModel.destroy({
                            success: function() {
                                this.sandbox.emit('sulu.router.navigate', 'settings/translate');
                            }.bind(this)
                        });
                    }
                }.bind(this));
            }, this);
        },

        getModel: function(id) {
            // FIXME: fixed challenge Cannot instantiate more than one Backbone.RelationalModel with the same id per type!
            var packageModel = Package.findOrCreate(id);
            if (!packageModel) {
                packageModel = new Package({
                    id: id
                });
            }
            return packageModel;
        },

        renderList: function() {

            this.sandbox.start([
                {name: 'packages/components/list@sulutranslate', options: { el: this.$el}}
            ]);

            // wait for navigation events
            this.sandbox.on('sulu.translate.package.load', function(id) {
                this.sandbox.emit('husky.header.button-state', 'loading-add-button');
                this.sandbox.emit('sulu.router.navigate', 'settings/translate/edit:' + id + '/settings');
            }, this);

            // add new contact
            this.sandbox.on('sulu.translate.package.new', function() {
                this.sandbox.emit('husky.header.button-state', 'loading-add-button');
                this.sandbox.emit('sulu.router.navigate', 'settings/translate/add');
            }, this);

            // delete selected contacts
            this.sandbox.on('sulu.translate.packages.delete', function(ids) {
                if (ids.length < 1) {
                    this.sandbox.emit('sulu.dialog.error.show', 'No package selected for Deletion');
                    return;
                }
                this.confirmDeleteDialog(function(wasConfirmed) {
                    if (wasConfirmed) {
                        this.sandbox.emit('husky.header.button-state', 'loading-add-button');

                        ids.forEach(function(id) {
                            var packageModel = this.getModel(id);

                            packageModel.destroy({
                                success: function() {
                                    this.sandbox.emit('husky.datagrid.row.remove', id);
                                }.bind(this)
                            });
                        }.bind(this));
                        this.sandbox.emit('husky.header.button-state', 'standard');
                    }
                });
            }, this);

        },

        renderSettings: function() {
            var packageModel;
            if (!!this.options.id) {
                 packageModel = this.getModel(this.options.id);

                packageModel.fetch({
                    success: function(model) {
                        this.sandbox.start([
                            {name: 'packages/components/settings@sulutranslate', options: { el: this.$el, data: model.toJSON()}}
                        ]);
                    }.bind(this),
                    error: function() {
                        this.sandbox.logger.log("error while fetching contact");
                    }.bind(this)
                });
            } else {
                packageModel = new Package();
                this.sandbox.start([
                    {name: 'packages/components/settings@sulutranslate', options: { el: this.$el, data: packageModel.toJSON()}}
                ]);
            }

            // save contact
            this.sandbox.on('sulu.translate.package.save', function(data) {
                var packageModel = new Package();
                if (!!data.id) {
                    packageModel = this.getModel(data.id);
                }

                this.sandbox.emit('husky.header.button-state', 'loading-save-button');
                packageModel.set(data);
                packageModel.save(null, {
                    // on success save contacts id
                    success: function(response) {
                        var model = response.toJSON();
                        this.sandbox.emit('husky.header.button-state', 'standard');
                        //this.sandbox.emit('sulu.translate.package.saved', model.id, model);
                        this.sandbox.emit('sulu.router.navigate', 'settings/translate/edit:' + model.id + '/settings');
                    }.bind(this),
                    error: function() {
                        this.sandbox.logger.log("error while saving profile");
                    }.bind(this)
                });
            }, this);
        },

        renderDetails: function() {
            if (!!this.options.id) {
                var packageModel = this.getModel(this.options.id);

                packageModel.fetch({
                    success: function(model) {
                        this.loadCatalogues(model);
                    }.bind(this),
                    error: function() {
                        this.sandbox.logger.log("error while fetching contact");
                    }.bind(this)
                });
            }

            // save
            this.sandbox.on('sulu.translate.translations.save', this.saveTranslations.bind(this));

            // selected catalogue in select-field changed
            this.sandbox.on('sulu.translate.catalogue.changed', function(packageId, catalogueId) {
                this.sandbox.emit('sulu.router.navigate', 'settings/translate/edit:' + packageId + '/details:' + catalogueId);
            }, this);
        },

        loadCatalogues: function(packageModel) {
            var catalogues = packageModel.get('catalogues'),
                selectedCatalogue;

            if (!!catalogues.at(0)) {
                // when id for catalogue in url
                if (!!this.options.catalogue) {
                    selectedCatalogue = catalogues.get(this.options.catalogue);
                } else {
                    selectedCatalogue = catalogues.findWhere({isDefault: true});

                    if (!selectedCatalogue) {
                        selectedCatalogue = catalogues.at(0);
                    }
                }
                this.loadTranslations(packageModel, selectedCatalogue);

            } else {
                // TODO no catalogue exists
                throw 'error: no catalogue exists';
            }
        },

        loadTranslations: function(packageModel, selectedCatalogue) {

            this.translations = new Translations({translateCatalogueId: selectedCatalogue.get('id')});
            this.translations.fetch({
                success: function() {
                    this.sandbox.start([
                        {name: 'packages/components/details@sulutranslate', options: {
                            el: this.$el,
                            data: packageModel.toJSON(),
                            selectedCatalogue: selectedCatalogue.toJSON(),
                            translations: this.translations.toJSON()
                        }}
                    ]);
                }.bind(this),

                error: function() {
                    // TODO errormessage
                }.bind(this)
            });
        },

        saveTranslations: function(updatedTranslations, codesToDelete) {

            this.sandbox.emit('husky.header.button-state', 'loading-save-button');

            this.sandbox.util.each(codesToDelete, function(index) {
                var code = new Code({id: codesToDelete[index]});
                code.destroy({
                    success: function() {
                        this.sandbox.logger.log('Code deleted');
                    }.bind(this),
                    error: function() {
                        // TODO errormessage/-handling
                    }
                });
            }.bind(this));

            if (updatedTranslations.length > 0) {
                this.translations.save(this.sandbox, updatedTranslations);
            }

            this.sandbox.emit('husky.header.button-state', 'standard');

        },

        /**
         * @var ids - array of ids to delete
         * @var callback - callback function returns true or false if data got deleted
         */
        confirmDeleteDialog: function(callbackFunction) {
            // check if callback is a function
            if (!!callbackFunction && typeof(callbackFunction) !== 'function') {
                throw 'callback is not a function';
            }

            // show dialog
            this.sandbox.emit('sulu.dialog.confirmation.show', {
                content: {
                    title: "Be careful!",
                    content: "<p>The operation you are about to do will delete data.<br/>This is not undoable!</p><p>Please think about it and accept or decline.</p>"
                },
                footer: {
                    buttonCancelText: "Don't do it",
                    buttonSubmitText: "Do it, I understand"
                }
            });

            // submit -> delete
            this.sandbox.once('husky.dialog.submit', function() {
                this.sandbox.emit('husky.dialog.hide');
                if (!!callbackFunction) {
                    callbackFunction.call(this, true);
                }
            }.bind(this));

            // cancel
            this.sandbox.once('husky.dialog.cancel', function() {
                this.sandbox.emit('husky.dialog.hide');
                if (!!callbackFunction) {
                    callbackFunction.call(this, false);
                }
            }.bind(this));
        }

    };
});
