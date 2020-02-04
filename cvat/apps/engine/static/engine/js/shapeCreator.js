/*
 * Copyright (C) 2018 Intel Corporation
 *
 * SPDX-License-Identifier: MIT
 */

/* exported ShapeCreatorModel ShapeCreatorController ShapeCreatorView */

/* global
    AREA_TRESHOLD:false
    drawBoxSize:false
    Listener:false
    Logger:false
    Mousetrap:false
    PolyShapeModel:false
    showMessage:false
    STROKE_WIDTH:false
    SVG:false
    BorderSticker: false
*/

class ShapeCreatorModel extends Listener {
    constructor(shapeCollection) {
        super('onShapeCreatorUpdate', () => this);
        this._createMode = false;
        this._saveCurrent = false;
        this._defaultType = null;
        this._defaultMode = null;
        this._defaultLabel = null;
        this._currentFrame = null;
        this._createEvent = null;
        this._shapeCollection = shapeCollection;
    }

    finish(result) {
        const data = {};
        const frame = window.cvat.player.frames.current;

        data.label_id = this._defaultLabel;
        data.group = 0;
        data.frame = frame;
        data.occluded = false;
        data.outside = false;
        data.z_order = this._shapeCollection.zOrder(frame).max;
        data.attributes = [];

        if (this._createEvent) {
            this._createEvent.addValues({
                mode: this._defaultMode,
                type: this._defaultType,
                label: this._defaultLabel,
                frame,
            });
        }

        // FIXME: In the future we have to make some generic solution
        if (this._defaultMode === 'interpolation' 
            && ['box', 'points', 'box_by_4_points'].includes(this._defaultType)) {
            data.shapes = [];
            data.shapes.push(Object.assign({}, result, data));
            this._shapeCollection.add(data, `interpolation_${this._defaultType}`);
        } else {
            Object.assign(data, result);
            this._shapeCollection.add(data, `annotation_${this._defaultType}`);
        }

        const model = this._shapeCollection.shapes.slice(-1)[0];

        // Undo/redo code
        window.cvat.addAction('Draw Object', () => {
            model.removed = true;
            model.unsubscribe(this._shapeCollection);
        }, () => {
            model.subscribe(this._shapeCollection);
            model.removed = false;
        }, window.cvat.player.frames.current);
        // End of undo/redo code

        this._shapeCollection.update();
    }

    switchCreateMode(forceClose, usingShortkey) {
        this._usingShortkey = usingShortkey;
        // if parameter force (bool) setup to true, current result will not save
        if (!forceClose) {
            this._createMode = !this._createMode && window.cvat.mode == null;
            if (this._createMode) {
                this._createEvent = Logger.addContinuedEvent(Logger.EventType.drawObject);
                window.cvat.mode = 'creation';
            } else if (window.cvat.mode === 'creation') {
                window.cvat.mode = null;
            }
        } else {
            this._createMode = false;
            if (window.cvat.mode === 'creation') {
                window.cvat.mode = null;
                if (this._createEvent) {
                    this._createEvent.close();
                    this._createEvent = null;
                }
            }
        }
        this._saveCurrent = !forceClose;
        this.notify();
    }

    get currentShapes() {
        this._shapeCollection.update();
        return this._shapeCollection.currentShapes;
    }

    get saveCurrent() {
        return this._saveCurrent;
    }

    get createMode() {
        return this._createMode;
    }

    get usingShortkey() {
        return this._usingShortkey;
    }

    get defaultType() {
        return this._defaultType;
    }

    set defaultType(type) {
        if (!['box', 'box_by_4_points', 'points', 'polygon', 'polyline'].includes(type)) {
            throw Error(`Unknown shape type found ${type}`);
        }
        this._defaultType = type;
    }

    get defaultMode() {
        return this._defaultMode;
    }

    set defaultMode(mode) {
        this._defaultMode = mode;
    }

    set defaultLabel(labelId) {
        this._defaultLabel = +labelId;
    }
}


class ShapeCreatorController {
    constructor(drawerModel) {
        this._model = drawerModel;
        setupShortkeys.call(this);
        function setupShortkeys() {
            let shortkeys = window.cvat.config.shortkeys;

            let switchDrawHandler = Logger.shortkeyLogDecorator(function() {
                this.switchCreateMode(false, true);
            }.bind(this));

            Mousetrap.bind(shortkeys["switch_draw_mode"].value, switchDrawHandler.bind(this), 'keydown');
        }
    }

    switchCreateMode(force, usingShortkey = false) {
        this._model.switchCreateMode(force, usingShortkey);
    }

    setDefaultShapeType(type) {
        this._model.defaultType = type;
    }

    setDefaultShapeMode(mode) {
        this._model.defaultMode = mode;
    }

    setDefaultShapeLabel(labelId) {
        this._model.defaultLabel = labelId;
    }

    finish(result) {
        this._model.finish(result);
    }

    get currentShapes() {
        return this._model.currentShapes;
    }
}

class ShapeCreatorView {
    constructor(drawerModel, drawerController) {
        drawerModel.subscribe(this);
        this._controller = drawerController;
        this._createButton = $('#createShapeButton');
        this._labelSelector = $('#shapeLabelSelector');
        this._modeSelector = $('#shapeModeSelector');
        this._typeSelector = $('#shapeTypeSelector');
        this._polyShapeSizeInput = $('#polyShapeSize');
        this._commonBordersCheckbox = $('#commonBordersCheckbox');
        this._frameContent = SVG.adopt($('#frameContent')[0]);
        this._frameText = SVG.adopt($('#frameText')[0]);
        this._playerFrame = $('#playerFrame');
        this._createButton.on('click', () => this._controller.switchCreateMode(false));
        this._drawInstance = null;
        this._aim = null;
        this._aimCoord = {
            x: 0,
            y: 0
        };
        this._polyShapeSize = 0;
        this._type = null;
        this._mode = null;
        this._cancel = false;
        this._scale = 1;
        this._borderSticker = null;

        let shortkeys = window.cvat.config.shortkeys;
        this._createButton.attr('title', `
            ${shortkeys['switch_draw_mode'].view_value} - ${shortkeys['switch_draw_mode'].description}`);

        this._labelSelector.attr('title', `
            ${shortkeys['change_default_label'].view_value} - ${shortkeys['change_default_label'].description}`);

        const labels = window.cvat.labelsInfo.labels();
        const labelsKeys = Object.keys(labels);
        for (let i = 0; i < labelsKeys.length; i += 1) {
            this._labelSelector.append(
                // eslint-disable-next-line
                $(`<option value=${labelsKeys[i]}> ${labels[labelsKeys[i]].normalize()} </option>`)
            );
        }
        this._labelSelector.val(labelsKeys[0]);

        this._typeSelector.val('box');
        this._typeSelector.on('change', (e) => {
            // FIXME: In the future we have to make some generic solution
            const mode = this._modeSelector.prop('value');
            const type = $(e.target).prop('value');
            if (type !== 'box' && type !== 'box_by_4_points' 
                && !(type === 'points' && this._polyShapeSize === 1) && mode !== 'annotation') {
                this._modeSelector.prop('value', 'annotation');
                this._controller.setDefaultShapeMode('annotation');
                showMessage('Only the annotation mode allowed for the shape');
            }
            this._controller.setDefaultShapeType(type);
        }).trigger('change');

        this._labelSelector.on('change', (e) => {
            this._controller.setDefaultShapeLabel($(e.target).prop('value'));
        }).trigger('change');

        this._modeSelector.on('change', (e) => {
            // FIXME: In the future we have to make some generic solution
            const mode = $(e.target).prop('value');
            const type = this._typeSelector.prop('value');
            if (mode !== 'annotation' && !(type === 'points' && this._polyShapeSize === 1)
                && type !== 'box' && type !== 'box_by_4_points') {
                this._typeSelector.prop('value', 'box');
                this._controller.setDefaultShapeType('box');
                showMessage('Only boxes and single point allowed in the interpolation mode');
            }
            this._controller.setDefaultShapeMode(mode);
        }).trigger('change');

        this._polyShapeSizeInput.on('change', (e) => {
            e.stopPropagation();
            let size = +e.target.value;
            if (size < 0) size = 0;
            if (size > 100) size = 0;
            const mode = this._modeSelector.prop('value');
            const type = this._typeSelector.prop('value');
            if (mode === 'interpolation' && type === 'points' && size !== 1) {
                showMessage('Only single point allowed in the interpolation mode');
                size = 1;
            }

            e.target.value = size || '';
            this._polyShapeSize = size;
        }).trigger('change');

        this._polyShapeSizeInput.on('keydown', function(e) {
            e.stopPropagation();
        });

        this._playerFrame.on('mousemove.shapeCreatorAIM', (e) => {
            if (!['polygon', 'polyline', 'points'].includes(this._type)) {
                this._aimCoord = window.cvat.translate.point.clientToCanvas(this._frameContent.node, e.clientX, e.clientY);
                if (this._aim) {
                    this._aim.x.attr({
                        y1: this._aimCoord.y,
                        y2: this._aimCoord.y,
                    });

                    this._aim.y.attr({
                        x1: this._aimCoord.x,
                        x2: this._aimCoord.x,
                    });
                }
            }
        });

        this._commonBordersCheckbox.on('change.shapeCreator', (e) => {
            if (this._drawInstance) {
                if (!e.target.checked) {
                    if (this._borderSticker) {
                        this._borderSticker.disable();
                        this._borderSticker = null;
                    }
                } else {
                    this._borderSticker = new BorderSticker(this._drawInstance, this._frameContent,
                        this._controller.currentShapes, this._scale);
                }
            }
        });
    }

    _createPolyEvents() {
        // If number of points for poly shape specified, use it.
        // Dicrement number on draw new point events. Drawstart trigger when create first point
        let lastPoint = {
            x: null,
            y: null,
        };

        let numberOfPoints = 0;
        this._drawInstance.attr({
            z_order: Number.MAX_SAFE_INTEGER,
        });

        if (this._polyShapeSize) {
            let size = this._polyShapeSize;
            const sizeDecrement = function sizeDecrement() {
                size -= 1;
                if (!size) {
                    numberOfPoints = this._polyShapeSize;
                    this._drawInstance.draw('done');
                }
            }.bind(this);

            const sizeIncrement = function sizeIncrement() {
                size += 1;
            };

            this._drawInstance.on('drawstart', sizeDecrement);
            this._drawInstance.on('drawpoint', sizeDecrement);
            this._drawInstance.on('undopoint', sizeIncrement);
        }
        // Otherwise draw will stop by Ctrl + N press

        this._drawInstance.on('drawpoint', () => {
            if (this._borderSticker) {
                this._borderSticker.reset();
            }
        });

        // Callbacks for point scale
        this._drawInstance.on('drawstart', this._rescaleDrawPoints.bind(this));
        this._drawInstance.on('drawpoint', this._rescaleDrawPoints.bind(this));

        this._drawInstance.on('drawstart', (e) => {
            lastPoint = {
                x: e.detail.event.clientX,
                y: e.detail.event.clientY,
            };
            numberOfPoints ++;
        });

        this._drawInstance.on('drawpoint', (e) => {
            lastPoint = {
                x: e.detail.event.clientX,
                y: e.detail.event.clientY,
            };
            numberOfPoints ++;
        });

        this._commonBordersCheckbox.css('display', '').trigger('change.shapeCreator');
        this._commonBordersCheckbox.parent().css('display', '');
        $('body').on('keydown.shapeCreator', (e) => {
            if (e.ctrlKey && e.keyCode === 17) {
                this._commonBordersCheckbox.prop('checked', !this._borderSticker);
                this._commonBordersCheckbox.trigger('change.shapeCreator');
            }
        });

        this._frameContent.on('mousedown.shapeCreator', (e) => {
            if (e.which === 3) {
                let lenBefore = this._drawInstance.array().value.length;
                this._drawInstance.draw('undo');
                if (this._borderSticker) {
                    this._borderSticker.reset();
                }
                let lenAfter = this._drawInstance.array().value.length;
                if (lenBefore != lenAfter) {
                    numberOfPoints --;
                }
            }
        });

        this._frameContent.on('mousemove.shapeCreator', (e) => {
            if (e.shiftKey && ['polygon', 'polyline'].includes(this._type)) {
                if (lastPoint.x === null || lastPoint.y === null) {
                    this._drawInstance.draw('point', e);
                }
                else {
                    let delta = Math.sqrt(Math.pow(e.clientX - lastPoint.x, 2) + Math.pow(e.clientY - lastPoint.y, 2));
                    let deltaTreshold = 15;
                    if (delta > deltaTreshold) {
                        this._drawInstance.draw('point', e);
                        lastPoint = {
                            x: e.clientX,
                            y: e.clientY,
                        };
                    }
                }
            }
        });

        this._drawInstance.on('drawstop', () => {
            this._frameContent.off('mousedown.shapeCreator');
            this._frameContent.off('mousemove.shapeCreator');
            this._commonBordersCheckbox.css('display', 'none');
            this._commonBordersCheckbox.parent().css('display', 'none');
            $('body').off('keydown.shapeCreator');
            if (this._borderSticker) {
                this._borderSticker.disable();
                this._borderSticker = null;
            }
        });
        // Also we need callback on drawdone event for get points
        this._drawInstance.on('drawdone', function(e) {
            let actualPoints = window.cvat.translate.points.canvasToActual(e.target.getAttribute('points'));
            actualPoints = PolyShapeModel.convertStringToNumberArray(actualPoints);

            // Min 2 points for polyline and 3 points for polygon
            if (actualPoints.length) {
                if (this._type === 'polyline' && actualPoints.length < 2) {
                    showMessage("Min 2 points must be for polyline drawing.");
                }
                else if (this._type === 'polygon' && actualPoints.length < 3) {
                    showMessage("Min 3 points must be for polygon drawing.");
                }
                else {
                    let frameWidth = window.cvat.player.geometry.frameWidth;
                    let frameHeight = window.cvat.player.geometry.frameHeight;
                    for (let point of actualPoints) {
                        point.x = Math.clamp(point.x, 0, frameWidth);
                        point.y = Math.clamp(point.y, 0, frameHeight);
                    }
                    actualPoints =  PolyShapeModel.convertNumberArrayToString(actualPoints);

                    // Update points in a view in order to get an updated box
                    e.target.setAttribute('points', window.cvat.translate.points.actualToCanvas(actualPoints));
                    let polybox = e.target.getBBox();
                    let w = polybox.width;
                    let h = polybox.height;
                    let area = w * h;
                    let type = this._type;

                    if (area >= AREA_TRESHOLD || type === 'points' && numberOfPoints || type === 'polyline' && (w >= AREA_TRESHOLD || h >= AREA_TRESHOLD)) {
                        this._controller.finish({points: actualPoints}, type);
                    }
                }
            }

            this._controller.switchCreateMode(true);
        }.bind(this));
    }

    _create() {
        let sizeUI = null;
        switch(this._type) {
        case 'box':
            this._drawInstance = this._frameContent.rect().draw({ snapToGrid: 0.1 }).addClass('shapeCreation').attr({
                'stroke-width': STROKE_WIDTH / this._scale,
                z_order: Number.MAX_SAFE_INTEGER,
            }).on('drawstop', function(e) {
                if (this._cancel) return;
                if (sizeUI) {
                    sizeUI.rm();
                    sizeUI = null;
                }

                const frameWidth = window.cvat.player.geometry.frameWidth;
                const frameHeight = window.cvat.player.geometry.frameHeight;
                const rect = window.cvat.translate.box.canvasToActual(e.target.getBBox());

                const xtl = Math.clamp(rect.x, 0, frameWidth);
                const ytl = Math.clamp(rect.y, 0, frameHeight);
                const xbr = Math.clamp(rect.x + rect.width, 0, frameWidth);
                const ybr = Math.clamp(rect.y + rect.height, 0, frameHeight);
                if ((ybr - ytl) * (xbr - xtl) >= AREA_TRESHOLD) {
                    const box = {
                        xtl,
                        ytl,
                        xbr,
                        ybr,
                    };

                    if (this._mode === 'interpolation') {
                        box.outside = false;
                    }

                    this._controller.finish(box, this._type);
                }

                this._controller.switchCreateMode(true);
            }.bind(this)).on('drawupdate', (e) => {
                sizeUI = drawBoxSize.call(sizeUI, this._frameContent, this._frameText, e.target.getBBox());
            }).on('drawcancel', () => {
                if (sizeUI) {
                    sizeUI.rm();
                    sizeUI = null;
                }
            });
            break;
        case 'box_by_4_points':
            let numberOfPoints = 0;
            this._drawInstance = this._frameContent.polyline().draw({ snapToGrid: 0.1 })
                .addClass('shapeCreation').attr({
                    'stroke-width': 0,
                }).on('drawstart', () => {
                    // init numberOfPoints as one on drawstart
                    numberOfPoints = 1;
                }).on('drawpoint', (e) => {
                    // increase numberOfPoints by one on drawpoint
                    numberOfPoints += 1;

                    // finish if numberOfPoints are exactly four
                    if (numberOfPoints === 4) {
                        let actualPoints = window.cvat.translate.points.canvasToActual(e.target.getAttribute('points'));
                        actualPoints = PolyShapeModel.convertStringToNumberArray(actualPoints);
                        const { frameWidth, frameHeight } = window.cvat.player.geometry;

                        // init bounding box
                        const box = {
                            'xtl': frameWidth,
                            'ytl': frameHeight,
                            'xbr': 0,
                            'ybr': 0
                        };

                        for (const point of actualPoints) {
                            // clamp point
                            point.x = Math.clamp(point.x, 0, frameWidth);
                            point.y = Math.clamp(point.y, 0, frameHeight);

                            // update bounding box
                            box.xtl = Math.min(point.x, box.xtl);
                            box.ytl = Math.min(point.y, box.ytl);
                            box.xbr = Math.max(point.x, box.xbr);
                            box.ybr = Math.max(point.y, box.ybr);
                        }

                        if ((box.ybr - box.ytl) * (box.xbr - box.xtl) >= AREA_TRESHOLD) {
                            if (this._mode === 'interpolation') {
                                box.outside = false;
                            }
                            // finish drawing
                            this._controller.finish(box, this._type);
                        }
                        this._controller.switchCreateMode(true);
                    }
                }).on('undopoint', () => {
                    if (numberOfPoints > 0) {
                        numberOfPoints -= 1;
                    }
                }).off('drawdone').on('drawdone', () => {
                    if (numberOfPoints !== 4) {
                        showMessage('Click exactly four extreme points for an object');
                        this._controller.switchCreateMode(true);
                    } else {
                        throw Error('numberOfPoints is exactly four, but box drawing did not finish.');
                    }
                });
            this._createPolyEvents();
            break;
        case 'points':
            this._drawInstance = this._frameContent.polyline().draw({ snapToGrid: 0.1 })
                .addClass('shapeCreation').attr({
                    'stroke-width': 0,
                });
            this._createPolyEvents();
            break;
        case 'polygon':
            if (this._polyShapeSize && this._polyShapeSize < 3) {
                if (!$('.drawAllert').length) {
                    showMessage("Min 3 points must be for polygon drawing.").addClass('drawAllert');
                }
                this._controller.switchCreateMode(true);
                return;
            }
            this._drawInstance = this._frameContent.polygon().draw({ snapToGrid: 0.1 })
                .addClass('shapeCreation').attr({
                    'stroke-width':  STROKE_WIDTH / this._scale,
                });
            this._createPolyEvents();
            break;
        case 'polyline':
            if (this._polyShapeSize && this._polyShapeSize < 2) {
                if (!$('.drawAllert').length) {
                    showMessage("Min 2 points must be for polyline drawing.").addClass('drawAllert');
                }
                this._controller.switchCreateMode(true);
                return;
            }
            this._drawInstance = this._frameContent.polyline().draw({ snapToGrid: 0.1 })
                .addClass('shapeCreation').attr({
                    'stroke-width':  STROKE_WIDTH / this._scale,
                });
            this._createPolyEvents();
            break;
        default:
            throw Error(`Bad type found ${this._type}`);
        }
    }

    _rescaleDrawPoints() {
        let scale = this._scale;
        $('.svg_draw_point').each(function() {
            this.instance.radius(2.5 / scale).attr('stroke-width', 1 / scale);
        });
    }

    _drawAim() {
        if (!(this._aim)) {
            this._aim = {
                x: this._frameContent.line(0, this._aimCoord.y, this._frameContent.node.clientWidth, this._aimCoord.y)
                    .attr({
                        'stroke-width': STROKE_WIDTH / this._scale,
                        'stroke': 'red',
                        'z_order': Number.MAX_SAFE_INTEGER,
                    }).addClass('aim'),
                y: this._frameContent.line(this._aimCoord.x, 0, this._aimCoord.x, this._frameContent.node.clientHeight)
                    .attr({
                        'stroke-width': STROKE_WIDTH / this._scale,
                        'stroke': 'red',
                        'z_order': Number.MAX_SAFE_INTEGER,
                    }).addClass('aim'),
            };
        }
    }

    _removeAim() {
        if (this._aim) {
            this._aim.x.remove();
            this._aim.y.remove();
            this._aim = null;
        }
    }

    onShapeCreatorUpdate(model) {
        if (model.createMode && !this._drawInstance) {
            this._cancel = false;
            this._type = model.defaultType;
            this._mode = model.defaultMode;

            if (!['polygon', 'polyline', 'points'].includes(this._type)) {
                if (!model.usingShortkey) {
                    this._aimCoord = {
                        x: 0,
                        y: 0
                    };
                }
                this._drawAim();
            }

            this._createButton.text("Stop Creation");
            document.oncontextmenu = () => false;
            this._create();
        }
        else {
            this._removeAim();
            this._cancel = true;
            this._createButton.text("Create Shape");
            document.oncontextmenu = null;
            if (this._drawInstance) {
                // We save current result for poly shape if it's need
                // drawInstance will be removed after save when drawdone handler calls switchCreateMode with force argument
                if (model.saveCurrent && this._type != 'box') {
                    this._drawInstance.draw('done');
                }
                else {
                    this._drawInstance.draw('cancel');
                    this._drawInstance.remove();
                    this._drawInstance = null;
                }
            }
        }

        this._typeSelector.prop('disabled', model.createMode);
        this._modeSelector.prop('disabled', model.createMode);
        this._polyShapeSizeInput.prop('disabled', model.createMode);
    }

    onPlayerUpdate(player) {
        if (!player.ready()) return;
        if (this._scale != player.geometry.scale) {
            this._scale = player.geometry.scale;
            if (this._drawInstance) {
                this._rescaleDrawPoints();
                if (this._borderSticker) {
                    this._borderSticker.scale(this._scale);
                }
                if (this._aim) {
                    this._aim.x.attr('stroke-width', STROKE_WIDTH / this._scale);
                    this._aim.y.attr('stroke-width', STROKE_WIDTH / this._scale);
                }
                if (['box', 'polygon', 'polyline'].includes(this._type)) {
                    this._drawInstance.attr('stroke-width', STROKE_WIDTH / this._scale);
                }
            }
        }
    }
}
