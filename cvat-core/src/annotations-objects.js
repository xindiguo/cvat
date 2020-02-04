/*
* Copyright (C) 2019 Intel Corporation
* SPDX-License-Identifier: MIT
*/

/* global
    require:false
*/

(() => {
    const ObjectState = require('./object-state');
    const {
        checkObjectType,
    } = require('./common');
    const {
        colors,
        ObjectShape,
        ObjectType,
        AttributeType,
    } = require('./enums');

    const {
        DataError,
        ArgumentError,
        ScriptingError,
    } = require('./exceptions');

    const { Label } = require('./labels');

    const defaultGroupColor = '#E0E0E0';

    // Called with the Annotation context
    function objectStateFactory(frame, data) {
        const objectState = new ObjectState(data);

        // eslint-disable-next-line no-underscore-dangle
        objectState.__internal = {
            save: this.save.bind(this, frame, objectState),
            delete: this.delete.bind(this),
            up: this.up.bind(this, frame, objectState),
            down: this.down.bind(this, frame, objectState),
        };

        return objectState;
    }

    function checkNumberOfPoints(shapeType, points) {
        if (shapeType === ObjectShape.RECTANGLE) {
            if (points.length / 2 !== 2) {
                throw new DataError(
                    `Rectangle must have 2 points, but got ${points.length / 2}`,
                );
            }
        } else if (shapeType === ObjectShape.POLYGON) {
            if (points.length / 2 < 3) {
                throw new DataError(
                    `Polygon must have at least 3 points, but got ${points.length / 2}`,
                );
            }
        } else if (shapeType === ObjectShape.POLYLINE) {
            if (points.length / 2 < 2) {
                throw new DataError(
                    `Polyline must have at least 2 points, but got ${points.length / 2}`,
                );
            }
        } else if (shapeType === ObjectShape.POINTS) {
            if (points.length / 2 < 1) {
                throw new DataError(
                    `Points must have at least 1 points, but got ${points.length / 2}`,
                );
            }
        } else {
            throw new ArgumentError(
                `Unknown value of shapeType has been recieved ${shapeType}`,
            );
        }
    }

    function checkShapeArea(shapeType, points) {
        const MIN_SHAPE_LENGTH = 3;
        const MIN_SHAPE_AREA = 9;

        if (shapeType === ObjectShape.POINTS) {
            return true;
        }

        let xmin = Number.MAX_SAFE_INTEGER;
        let xmax = Number.MIN_SAFE_INTEGER;
        let ymin = Number.MAX_SAFE_INTEGER;
        let ymax = Number.MIN_SAFE_INTEGER;

        for (let i = 0; i < points.length - 1; i += 2) {
            xmin = Math.min(xmin, points[i]);
            xmax = Math.max(xmax, points[i]);
            ymin = Math.min(ymin, points[i + 1]);
            ymax = Math.max(ymax, points[i + 1]);
        }

        if (shapeType === ObjectShape.POLYLINE) {
            const length = Math.max(
                xmax - xmin,
                ymax - ymin,
            );

            return length >= MIN_SHAPE_LENGTH;
        }

        const area = (xmax - xmin) * (ymax - ymin);
        return area >= MIN_SHAPE_AREA;
    }

    function validateAttributeValue(value, attr) {
        const { values } = attr;
        const type = attr.inputType;

        if (typeof (value) !== 'string') {
            throw new ArgumentError(
                `Attribute value is expected to be string, but got ${typeof (value)}`,
            );
        }

        if (type === AttributeType.NUMBER) {
            return +value >= +values[0]
                && +value <= +values[1]
                && !((+value - +values[0]) % +values[2]);
        }

        if (type === AttributeType.CHECKBOX) {
            return ['true', 'false'].includes(value.toLowerCase());
        }

        if (type === AttributeType.TEXT) {
            return true;
        }

        return values.includes(value);
    }

    class Annotation {
        constructor(data, clientID, injection) {
            this.taskLabels = injection.labels;
            this.clientID = clientID;
            this.serverID = data.id;
            this.group = data.group;
            this.label = this.taskLabels[data.label_id];
            this.frame = data.frame;
            this.removed = false;
            this.lock = false;
            this.updated = Date.now();
            this.attributes = data.attributes.reduce((attributeAccumulator, attr) => {
                attributeAccumulator[attr.spec_id] = attr.value;
                return attributeAccumulator;
            }, {});
            this.appendDefaultAttributes(this.label);

            injection.groups.max = Math.max(injection.groups.max, this.group);
        }

        appendDefaultAttributes(label) {
            const labelAttributes = label.attributes;
            for (const attribute of labelAttributes) {
                if (!(attribute.id in this.attributes)) {
                    this.attributes[attribute.id] = attribute.defaultValue;
                }
            }
        }

        updateTimestamp(updated) {
            const anyChanges = updated.label || updated.attributes || updated.points
                || updated.outside || updated.occluded || updated.keyframe
                || updated.zOrder;

            if (anyChanges) {
                this.updated = Date.now();
            }
        }

        delete(force) {
            if (!this.lock || force) {
                this.removed = true;
            }

            return true;
        }
    }

    class Drawn extends Annotation {
        constructor(data, clientID, color, injection) {
            super(data, clientID, injection);

            this.frameMeta = injection.frameMeta;
            this.collectionZ = injection.collectionZ;
            this.hidden = false;

            this.color = color;
            this.shapeType = null;
        }

        _getZ(frame) {
            this.collectionZ[frame] = this.collectionZ[frame] || {
                max: 0,
                min: 0,
            };

            return this.collectionZ[frame];
        }

        validateStateBeforeSave(frame, data) {
            let fittedPoints = [];
            const updated = data.updateFlags;

            if (updated.label) {
                checkObjectType('label', data.label, null, Label);
            }

            const labelAttributes = data.label.attributes
                .reduce((accumulator, value) => {
                    accumulator[value.id] = value;
                    return accumulator;
                }, {});

            if (updated.attributes) {
                for (const attrID of Object.keys(data.attributes)) {
                    const value = data.attributes[attrID];
                    if (attrID in labelAttributes) {
                        if (!validateAttributeValue(value, labelAttributes[attrID])) {
                            throw new ArgumentError(
                                `Trying to save an attribute attribute with id ${attrID} and invalid value ${value}`,
                            );
                        }
                    } else {
                        throw new ArgumentError(
                            `The label of the shape doesn't have the attribute with id ${attrID} and value ${value}`,
                        );
                    }
                }
            }

            if (updated.points) {
                checkObjectType('points', data.points, null, Array);
                checkNumberOfPoints(this.shapeType, data.points);
                // cut points
                const { width, height } = this.frameMeta[frame];
                for (let i = 0; i < data.points.length - 1; i += 2) {
                    const x = data.points[i];
                    const y = data.points[i + 1];

                    checkObjectType('coordinate', x, 'number', null);
                    checkObjectType('coordinate', y, 'number', null);

                    fittedPoints.push(
                        Math.clamp(x, 0, width),
                        Math.clamp(y, 0, height),
                    );
                }

                if (!checkShapeArea(this.shapeType, fittedPoints)) {
                    fittedPoints = false;
                }
            }

            if (updated.occluded) {
                checkObjectType('occluded', data.occluded, 'boolean', null);
            }

            if (updated.outside) {
                checkObjectType('outside', data.outside, 'boolean', null);
            }

            if (updated.zOrder) {
                checkObjectType('zOrder', data.zOrder, 'integer', null);
            }

            if (updated.lock) {
                checkObjectType('lock', data.lock, 'boolean', null);
            }

            if (updated.color) {
                checkObjectType('color', data.color, 'string', null);
                if (/^#[0-9A-F]{6}$/i.test(data.color)) {
                    throw new ArgumentError(
                        `Got invalid color value: "${data.color}"`,
                    );
                }
            }

            if (updated.hidden) {
                checkObjectType('hidden', data.hidden, 'boolean', null);
            }

            if (updated.keyframe) {
                checkObjectType('keyframe', data.keyframe, 'boolean', null);
            }

            return fittedPoints;
        }

        save() {
            throw new ScriptingError(
                'Is not implemented',
            );
        }

        get() {
            throw new ScriptingError(
                'Is not implemented',
            );
        }

        toJSON() {
            throw new ScriptingError(
                'Is not implemented',
            );
        }

        // Increase ZOrder within frame
        up(frame, objectState) {
            const z = this._getZ(frame);
            z.max++;
            objectState.zOrder = z.max;
        }

        // Decrease ZOrder within frame
        down(frame, objectState) {
            const z = this._getZ(frame);
            z.min--;
            objectState.zOrder = z.min;
        }
    }

    class Shape extends Drawn {
        constructor(data, clientID, color, injection) {
            super(data, clientID, color, injection);
            this.points = data.points;
            this.occluded = data.occluded;
            this.zOrder = data.z_order;

            const z = this._getZ(this.frame);
            z.max = Math.max(z.max, this.zOrder || 0);
            z.min = Math.min(z.min, this.zOrder || 0);
        }

        // Method is used to export data to the server
        toJSON() {
            return {
                type: this.shapeType,
                clientID: this.clientID,
                occluded: this.occluded,
                z_order: this.zOrder,
                points: [...this.points],
                attributes: Object.keys(this.attributes).reduce((attributeAccumulator, attrId) => {
                    attributeAccumulator.push({
                        spec_id: attrId,
                        value: this.attributes[attrId],
                    });

                    return attributeAccumulator;
                }, []),
                id: this.serverID,
                frame: this.frame,
                label_id: this.label.id,
                group: this.group,
            };
        }

        // Method is used to construct ObjectState objects
        get(frame) {
            if (frame !== this.frame) {
                throw new ScriptingError(
                    'Got frame is not equal to the frame of the shape',
                );
            }

            return {
                objectType: ObjectType.SHAPE,
                shapeType: this.shapeType,
                clientID: this.clientID,
                serverID: this.serverID,
                occluded: this.occluded,
                lock: this.lock,
                zOrder: this.zOrder,
                points: [...this.points],
                attributes: { ...this.attributes },
                label: this.label,
                group: {
                    color: this.group ? colors[this.group % colors.length] : defaultGroupColor,
                    id: this.group,
                },
                color: this.color,
                hidden: this.hidden,
                updated: this.updated,
                frame,
            };
        }

        save(frame, data) {
            if (frame !== this.frame) {
                throw new ScriptingError(
                    'Got frame is not equal to the frame of the shape',
                );
            }

            if (this.lock && data.lock) {
                return objectStateFactory.call(this, frame, this.get(frame));
            }

            const fittedPoints = this.validateStateBeforeSave(frame, data);
            const updated = data.updateFlags;

            // Now when all fields are validated, we can apply them
            if (updated.label) {
                this.label = data.label;
                this.attributes = {};
                this.appendDefaultAttributes(data.label);
            }

            if (updated.attributes) {
                for (const attrID of Object.keys(data.attributes)) {
                    this.attributes[attrID] = data.attributes[attrID];
                }
            }

            if (updated.points && fittedPoints.length) {
                this.points = [...fittedPoints];
            }

            if (updated.occluded) {
                this.occluded = data.occluded;
            }

            if (updated.zOrder) {
                this.zOrder = data.zOrder;
            }

            if (updated.lock) {
                this.lock = data.lock;
            }

            if (updated.color) {
                this.color = data.color;
            }

            if (updated.hidden) {
                this.hidden = data.hidden;
            }

            this.updateTimestamp(updated);
            updated.reset();

            return objectStateFactory.call(this, frame, this.get(frame));
        }
    }

    class Track extends Drawn {
        constructor(data, clientID, color, injection) {
            super(data, clientID, color, injection);
            this.shapes = data.shapes.reduce((shapeAccumulator, value) => {
                shapeAccumulator[value.frame] = {
                    serverID: value.id,
                    occluded: value.occluded,
                    zOrder: value.z_order,
                    points: value.points,
                    outside: value.outside,
                    attributes: value.attributes.reduce((attributeAccumulator, attr) => {
                        attributeAccumulator[attr.spec_id] = attr.value;
                        return attributeAccumulator;
                    }, {}),
                };

                const z = this._getZ(value.frame);
                z.max = Math.max(z.max, value.z_order);
                z.min = Math.min(z.min, value.z_order);

                return shapeAccumulator;
            }, {});
        }

        // Method is used to export data to the server
        toJSON() {
            const labelAttributes = this.label.attributes.reduce((accumulator, attribute) => {
                accumulator[attribute.id] = attribute;
                return accumulator;
            }, {});

            return {
                clientID: this.clientID,
                id: this.serverID,
                frame: this.frame,
                label_id: this.label.id,
                group: this.group,
                attributes: Object.keys(this.attributes).reduce((attributeAccumulator, attrId) => {
                    if (!labelAttributes[attrId].mutable) {
                        attributeAccumulator.push({
                            spec_id: attrId,
                            value: this.attributes[attrId],
                        });
                    }

                    return attributeAccumulator;
                }, []),
                shapes: Object.keys(this.shapes).reduce((shapesAccumulator, frame) => {
                    shapesAccumulator.push({
                        type: this.shapeType,
                        occluded: this.shapes[frame].occluded,
                        z_order: this.shapes[frame].zOrder,
                        points: [...this.shapes[frame].points],
                        outside: this.shapes[frame].outside,
                        attributes: Object.keys(this.shapes[frame].attributes)
                            .reduce((attributeAccumulator, attrId) => {
                                if (labelAttributes[attrId].mutable) {
                                    attributeAccumulator.push({
                                        spec_id: attrId,
                                        value: this.shapes[frame].attributes[attrId],
                                    });
                                }

                                return attributeAccumulator;
                            }, []),
                        id: this.shapes[frame].serverID,
                        frame: +frame,
                    });

                    return shapesAccumulator;
                }, []),
            };
        }

        // Method is used to construct ObjectState objects
        get(frame) {
            const {
                prev,
                next,
                first,
                last,
            } = this.boundedKeyframes(frame);

            return {
                ...this.getPosition(frame, prev, next),
                attributes: this.getAttributes(frame),
                group: {
                    color: this.group ? colors[this.group % colors.length] : defaultGroupColor,
                    id: this.group,
                },
                objectType: ObjectType.TRACK,
                shapeType: this.shapeType,
                clientID: this.clientID,
                serverID: this.serverID,
                lock: this.lock,
                color: this.color,
                hidden: this.hidden,
                updated: this.updated,
                label: this.label,
                keyframes: {
                    prev,
                    next,
                    first,
                    last,
                },
                frame,
            };
        }

        boundedKeyframes(targetFrame) {
            const frames = Object.keys(this.shapes).map((frame) => +frame);
            let lDiff = Number.MAX_SAFE_INTEGER;
            let rDiff = Number.MAX_SAFE_INTEGER;
            let first = Number.MAX_SAFE_INTEGER;
            let last = Number.MIN_SAFE_INTEGER;

            for (const frame of frames) {
                if (frame < first) {
                    first = frame;
                }
                if (frame > last) {
                    last = frame;
                }

                const diff = Math.abs(targetFrame - frame);

                if (frame < targetFrame && diff < lDiff) {
                    lDiff = diff;
                } else if (frame > targetFrame && diff < rDiff) {
                    rDiff = diff;
                }
            }

            const prev = lDiff === Number.MAX_SAFE_INTEGER ? null : targetFrame - lDiff;
            const next = rDiff === Number.MAX_SAFE_INTEGER ? null : targetFrame + rDiff;

            return {
                prev,
                next,
                first,
                last,
            };
        }

        getAttributes(targetFrame) {
            const result = {};

            // First of all copy all unmutable attributes
            for (const attrID in this.attributes) {
                if (Object.prototype.hasOwnProperty.call(this.attributes, attrID)) {
                    result[attrID] = this.attributes[attrID];
                }
            }

            // Secondly get latest mutable attributes up to target frame
            const frames = Object.keys(this.shapes).sort((a, b) => +a - +b);
            for (const frame of frames) {
                if (frame <= targetFrame) {
                    const { attributes } = this.shapes[frame];

                    for (const attrID in attributes) {
                        if (Object.prototype.hasOwnProperty.call(attributes, attrID)) {
                            result[attrID] = attributes[attrID];
                        }
                    }
                }
            }

            return result;
        }

        save(frame, data) {
            if (this.lock && data.lock) {
                return objectStateFactory.call(this, frame, this.get(frame));
            }

            const fittedPoints = this.validateStateBeforeSave(frame, data);
            const updated = data.updateFlags;
            const current = this.get(frame);
            const labelAttributes = data.label.attributes
                .reduce((accumulator, value) => {
                    accumulator[value.id] = value;
                    return accumulator;
                }, {});

            if (updated.label) {
                this.label = data.label;
                this.attributes = {};
                for (const shape of Object.values(this.shapes)) {
                    shape.attributes = {};
                }
                this.appendDefaultAttributes(data.label);
            }

            let mutableAttributesUpdated = false;
            if (updated.attributes) {
                for (const attrID of Object.keys(data.attributes)) {
                    if (!labelAttributes[attrID].mutable) {
                        this.attributes[attrID] = data.attributes[attrID];
                        this.attributes[attrID] = data.attributes[attrID];
                    } else if (data.attributes[attrID] !== current.attributes[attrID]) {
                        mutableAttributesUpdated = mutableAttributesUpdated
                            // not keyframe yet
                            || !(frame in this.shapes)
                            // keyframe, but without this attrID
                            || !(attrID in this.shapes[frame])
                            // keyframe with attrID, but with another value
                            || (this.shapes[frame][attrID] !== data.attributes[attrID]);
                    }
                }
            }

            if (updated.lock) {
                this.lock = data.lock;
            }

            if (updated.color) {
                this.color = data.color;
            }

            if (updated.hidden) {
                this.hidden = data.hidden;
            }

            if (updated.points || updated.keyframe || updated.outside
                || updated.occluded || updated.zOrder || mutableAttributesUpdated) {
                const mutableAttributes = frame in this.shapes ? this.shapes[frame].attributes : {};
                this.shapes[frame] = {
                    frame,
                    zOrder: data.zOrder,
                    points: updated.points && fittedPoints.length ? fittedPoints : current.points,
                    outside: data.outside,
                    occluded: data.occluded,
                    attributes: mutableAttributes,
                };

                for (const attrID of Object.keys(data.attributes)) {
                    if (labelAttributes[attrID].mutable
                        && data.attributes[attrID] !== current.attributes[attrID]) {
                        this.shapes[frame].attributes[attrID] = data.attributes[attrID];
                        this.shapes[frame].attributes[attrID] = data.attributes[attrID];
                    }
                }

                if (updated.keyframe && !data.keyframe) {
                    if (Object.keys(this.shapes).length === 1) {
                        throw new DataError('You are not able to remove the latest keyframe for a track. '
                            + 'Consider removing a track instead');
                    } else {
                        delete this.shapes[frame];
                    }
                }
            }

            this.updateTimestamp(updated);
            updated.reset();

            return objectStateFactory.call(this, frame, this.get(frame));
        }

        getPosition(targetFrame, leftKeyframe, rightFrame) {
            const leftFrame = targetFrame in this.shapes ? targetFrame : leftKeyframe;
            const rightPosition = Number.isInteger(rightFrame) ? this.shapes[rightFrame] : null;
            const leftPosition = Number.isInteger(leftFrame) ? this.shapes[leftFrame] : null;

            if (leftPosition && rightPosition) {
                return {
                    ...this.interpolatePosition(
                        leftPosition,
                        rightPosition,
                        (targetFrame - leftFrame) / (rightFrame - leftFrame),
                    ),
                    keyframe: targetFrame in this.shapes,
                };
            }

            if (leftPosition) {
                return {
                    points: [...leftPosition.points],
                    occluded: leftPosition.occluded,
                    outside: leftPosition.outside,
                    zOrder: 0,
                    keyframe: targetFrame in this.shapes,
                };
            }

            if (rightPosition) {
                return {
                    points: [...rightPosition.points],
                    occluded: rightPosition.occluded,
                    outside: true,
                    zOrder: 0,
                    keyframe: targetFrame in this.shapes,
                };
            }

            throw new DataError(
                'No one left position or right position was found. '
                + `Interpolation impossible. Client ID: ${this.id}`,
            );
        }

        delete(force) {
            if (!this.lock || force) {
                this.removed = true;
            }

            return this.removed;
        }
    }

    class Tag extends Annotation {
        constructor(data, clientID, injection) {
            super(data, clientID, injection);
        }

        // Method is used to export data to the server
        toJSON() {
            return {
                clientID: this.clientID,
                id: this.serverID,
                frame: this.frame,
                label_id: this.label.id,
                group: this.group,
                attributes: Object.keys(this.attributes).reduce((attributeAccumulator, attrId) => {
                    attributeAccumulator.push({
                        spec_id: attrId,
                        value: this.attributes[attrId],
                    });

                    return attributeAccumulator;
                }, []),
            };
        }

        // Method is used to construct ObjectState objects
        get(frame) {
            if (frame !== this.frame) {
                throw new ScriptingError(
                    'Got frame is not equal to the frame of the shape',
                );
            }

            return {
                objectType: ObjectType.TAG,
                clientID: this.clientID,
                serverID: this.serverID,
                lock: this.lock,
                attributes: { ...this.attributes },
                label: this.label,
                group: this.group,
                updated: this.updated,
                frame,
            };
        }

        save(frame, data) {
            if (frame !== this.frame) {
                throw new ScriptingError(
                    'Got frame is not equal to the frame of the shape',
                );
            }

            if (this.lock && data.lock) {
                return objectStateFactory.call(this, frame, this.get(frame));
            }

            if (this.lock && data.lock) {
                return objectStateFactory.call(this, frame, this.get(frame));
            }

            const updated = data.updateFlags;

            // First validate all the fields
            if (updated.label) {
                checkObjectType('label', data.label, null, Label);
            }

            if (updated.attributes) {
                const labelAttributes = data.label.attributes
                    .reduce((accumulator, value) => {
                        accumulator[value.id] = value;
                        return accumulator;
                    }, {});

                for (const attrID of Object.keys(data.attributes)) {
                    const value = data.attributes[attrID];
                    if (attrID in labelAttributes) {
                        if (!validateAttributeValue(value, labelAttributes[attrID])) {
                            throw new ArgumentError(
                                `Trying to save an attribute attribute with id ${attrID} and invalid value ${value}`,
                            );
                        }
                    } else {
                        throw new ArgumentError(
                            `Trying to save unknown attribute with id ${attrID} and value ${value}`,
                        );
                    }
                }
            }

            if (updated.lock) {
                checkObjectType('lock', data.lock, 'boolean', null);
            }

            // Now when all fields are validated, we can apply them
            if (updated.label) {
                this.label = data.label;
                this.attributes = {};
                this.appendDefaultAttributes(data.label);
            }

            if (updated.attributes) {
                for (const attrID of Object.keys(data.attributes)) {
                    this.attributes[attrID] = data.attributes[attrID];
                }
            }

            if (updated.lock) {
                this.lock = data.lock;
            }

            this.updateTimestamp(updated);
            updated.reset();

            return objectStateFactory.call(this, frame, this.get(frame));
        }
    }

    class RectangleShape extends Shape {
        constructor(data, clientID, color, injection) {
            super(data, clientID, color, injection);
            this.shapeType = ObjectShape.RECTANGLE;
            checkNumberOfPoints(this.shapeType, this.points);
        }

        static distance(points, x, y) {
            const [xtl, ytl, xbr, ybr] = points;

            if (!(x >= xtl && x <= xbr && y >= ytl && y <= ybr)) {
                // Cursor is outside of a box
                return null;
            }

            // The shortest distance from point to an edge
            return Math.min.apply(null, [x - xtl, y - ytl, xbr - x, ybr - y]);
        }
    }

    class PolyShape extends Shape {
        constructor(data, clientID, color, injection) {
            super(data, clientID, color, injection);
        }
    }

    class PolygonShape extends PolyShape {
        constructor(data, clientID, color, injection) {
            super(data, clientID, color, injection);
            this.shapeType = ObjectShape.POLYGON;
            checkNumberOfPoints(this.shapeType, this.points);
        }

        static distance(points, x, y) {
            function position(x1, y1, x2, y2) {
                return ((x2 - x1) * (y - y1) - (x - x1) * (y2 - y1));
            }

            let wn = 0;
            const distances = [];

            for (let i = 0, j = points.length - 2; i < points.length - 1; j = i, i += 2) {
                // Current point
                const x1 = points[j];
                const y1 = points[j + 1];

                // Next point
                const x2 = points[i];
                const y2 = points[i + 1];

                // Check if a point is inside a polygon
                // with a winding numbers algorithm
                // https://en.wikipedia.org/wiki/Point_in_polygon#Winding_number_algorithm
                if (y1 <= y) {
                    if (y2 > y) {
                        if (position(x1, y1, x2, y2) > 0) {
                            wn++;
                        }
                    }
                } else if (y2 <= y) {
                    if (position(x1, y1, x2, y2) < 0) {
                        wn--;
                    }
                }

                // Find the shortest distance from point to an edge
                // Get an equation of a line in general
                const aCoef = (y1 - y2);
                const bCoef = (x2 - x1);

                // Vector (aCoef, bCoef) is a perpendicular to line
                // Now find the point where two lines
                // (edge and its perpendicular through the point (x,y)) are cross
                const xCross = x - aCoef;
                const yCross = y - bCoef;

                if (((xCross - x1) * (x2 - xCross)) >= 0
                    && ((yCross - y1) * (y2 - yCross)) >= 0) {
                    // Cross point is on segment between p1(x1,y1) and p2(x2,y2)
                    distances.push(Math.sqrt(
                        Math.pow(x - xCross, 2)
                        + Math.pow(y - yCross, 2),
                    ));
                } else {
                    distances.push(
                        Math.min(
                            Math.sqrt(Math.pow(x1 - x, 2) + Math.pow(y1 - y, 2)),
                            Math.sqrt(Math.pow(x2 - x, 2) + Math.pow(y2 - y, 2)),
                        ),
                    );
                }
            }

            if (wn !== 0) {
                return Math.min.apply(null, distances);
            }

            return null;
        }
    }

    class PolylineShape extends PolyShape {
        constructor(data, clientID, color, injection) {
            super(data, clientID, color, injection);
            this.shapeType = ObjectShape.POLYLINE;
            checkNumberOfPoints(this.shapeType, this.points);
        }

        static distance(points, x, y) {
            const distances = [];
            for (let i = 0; i < points.length - 2; i += 2) {
                // Current point
                const x1 = points[i];
                const y1 = points[i + 1];

                // Next point
                const x2 = points[i + 2];
                const y2 = points[i + 3];

                // Find the shortest distance from point to an edge
                if (((x - x1) * (x2 - x)) >= 0 && ((y - y1) * (y2 - y)) >= 0) {
                    // Find the length of a perpendicular
                    // https://en.wikipedia.org/wiki/Distance_from_a_point_to_a_line
                    distances.push(
                        Math.abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1) / Math
                            .sqrt(Math.pow(y2 - y1, 2) + Math.pow(x2 - x1, 2)),
                    );
                } else {
                    // The link below works for lines (which have infinit length)
                    // There is a case when perpendicular doesn't cross the edge
                    // In this case we don't use the computed distance
                    // Instead we use just distance to the nearest point
                    distances.push(
                        Math.min(
                            Math.sqrt(Math.pow(x1 - x, 2) + Math.pow(y1 - y, 2)),
                            Math.sqrt(Math.pow(x2 - x, 2) + Math.pow(y2 - y, 2)),
                        ),
                    );
                }
            }

            return Math.min.apply(null, distances);
        }
    }

    class PointsShape extends PolyShape {
        constructor(data, clientID, color, injection) {
            super(data, clientID, color, injection);
            this.shapeType = ObjectShape.POINTS;
            checkNumberOfPoints(this.shapeType, this.points);
        }

        static distance(points, x, y) {
            const distances = [];
            for (let i = 0; i < points.length; i += 2) {
                const x1 = points[i];
                const y1 = points[i + 1];

                distances.push(
                    Math.sqrt(Math.pow(x1 - x, 2) + Math.pow(y1 - y, 2)),
                );
            }

            return Math.min.apply(null, distances);
        }
    }

    class RectangleTrack extends Track {
        constructor(data, clientID, color, injection) {
            super(data, clientID, color, injection);
            this.shapeType = ObjectShape.RECTANGLE;
            for (const shape of Object.values(this.shapes)) {
                checkNumberOfPoints(this.shapeType, shape.points);
            }
        }

        interpolatePosition(leftPosition, rightPosition, offset) {
            const positionOffset = [
                rightPosition.points[0] - leftPosition.points[0],
                rightPosition.points[1] - leftPosition.points[1],
                rightPosition.points[2] - leftPosition.points[2],
                rightPosition.points[3] - leftPosition.points[3],
            ];

            return { // xtl, ytl, xbr, ybr
                points: [
                    leftPosition.points[0] + positionOffset[0] * offset,
                    leftPosition.points[1] + positionOffset[1] * offset,
                    leftPosition.points[2] + positionOffset[2] * offset,
                    leftPosition.points[3] + positionOffset[3] * offset,
                ],
                occluded: leftPosition.occluded,
                outside: leftPosition.outside,
                zOrder: leftPosition.zOrder,
            };
        }
    }

    class PolyTrack extends Track {
        constructor(data, clientID, color, injection) {
            super(data, clientID, color, injection);
        }

        interpolatePosition(leftPosition, rightPosition, offset) {
            function findBox(points) {
                let xmin = Number.MAX_SAFE_INTEGER;
                let ymin = Number.MAX_SAFE_INTEGER;
                let xmax = Number.MIN_SAFE_INTEGER;
                let ymax = Number.MIN_SAFE_INTEGER;

                for (let i = 0; i < points.length; i += 2) {
                    if (points[i] < xmin) xmin = points[i];
                    if (points[i + 1] < ymin) ymin = points[i + 1];
                    if (points[i] > xmax) xmax = points[i];
                    if (points[i + 1] > ymax) ymax = points[i + 1];
                }

                return {
                    xmin,
                    ymin,
                    xmax,
                    ymax,
                };
            }

            function normalize(points, box) {
                const normalized = [];
                const width = box.xmax - box.xmin;
                const height = box.ymax - box.ymin;

                for (let i = 0; i < points.length; i += 2) {
                    normalized.push(
                        (points[i] - box.xmin) / width,
                        (points[i + 1] - box.ymin) / height,
                    );
                }

                return normalized;
            }

            function denormalize(points, box) {
                const denormalized = [];
                const width = box.xmax - box.xmin;
                const height = box.ymax - box.ymin;

                for (let i = 0; i < points.length; i += 2) {
                    denormalized.push(
                        points[i] * width + box.xmin,
                        points[i + 1] * height + box.ymin,
                    );
                }

                return denormalized;
            }

            function toPoints(array) {
                const points = [];
                for (let i = 0; i < array.length; i += 2) {
                    points.push({
                        x: array[i],
                        y: array[i + 1],
                    });
                }

                return points;
            }

            function toArray(points) {
                const array = [];
                for (const point of points) {
                    array.push(point.x, point.y);
                }

                return array;
            }

            function computeDistances(source, target) {
                const distances = {};
                for (let i = 0; i < source.length; i++) {
                    distances[i] = distances[i] || {};
                    for (let j = 0; j < target.length; j++) {
                        const dx = source[i].x - target[j].x;
                        const dy = source[i].y - target[j].y;

                        distances[i][j] = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
                    }
                }

                return distances;
            }

            function truncateByThreshold(mapping, threshold) {
                for (const key of Object.keys(mapping)) {
                    if (mapping[key].distance > threshold) {
                        delete mapping[key];
                    }
                }
            }

            // https://en.wikipedia.org/wiki/Stable_marriage_problem
            // TODO: One of important part of the algorithm is to correctly match
            // "corner" points. Thus it is possible for each of such point calculate
            // a descriptor (d) and use (x, y, d) to calculate the distance. One more
            // idea is to be sure that order or matched points is preserved. For example,
            // if p1 matches q1 and p2 matches q2 and between p1 and p2 we don't have any
            // points thus we should not have points between q1 and q2 as well.
            function stableMarriageProblem(men, women, distances) {
                const menPreferences = {};
                for (const man of men) {
                    menPreferences[man] = women.concat()
                        .sort((w1, w2) => distances[man][w1] - distances[man][w2]);
                }

                // Start alghoritm with max N^2 complexity
                const womenMaybe = {}; // id woman:id man,distance
                const menBusy = {}; // id man:boolean
                let prefIndex = 0;

                // While there is at least one free man
                while (Object.values(menBusy).length !== men.length) {
                    // Every man makes offer to the best woman
                    for (const man of men) {
                        // The man have already found a woman
                        if (menBusy[man]) {
                            continue;
                        }

                        const woman = menPreferences[man][prefIndex];
                        const distance = distances[man][woman];

                        // A women chooses the best offer and says "maybe"
                        if (woman in womenMaybe && womenMaybe[woman].distance > distance) {
                            // A woman got better offer
                            const prevChoice = womenMaybe[woman].value;
                            delete womenMaybe[woman];
                            delete menBusy[prevChoice];
                        }

                        if (!(woman in womenMaybe)) {
                            womenMaybe[woman] = {
                                value: man,
                                distance,
                            };

                            menBusy[man] = true;
                        }
                    }

                    prefIndex++;
                }

                const result = {};
                for (const woman of Object.keys(womenMaybe)) {
                    result[womenMaybe[woman].value] = {
                        value: woman,
                        distance: womenMaybe[woman].distance,
                    };
                }

                return result;
            }

            function getMapping(source, target) {
                function sumEdges(points) {
                    let result = 0;
                    for (let i = 1; i < points.length; i += 2) {
                        const distance = Math.sqrt(Math.pow(points[i].x - points[i - 1].x, 2)
                            + Math.pow(points[i].y - points[i - 1].y, 2));
                        result += distance;
                    }

                    // Corner case when work with one point
                    // Mapping in this case can't be wrong
                    if (!result) {
                        return Number.MAX_SAFE_INTEGER;
                    }

                    return result;
                }

                function computeDeviation(points, average) {
                    let result = 0;
                    for (let i = 1; i < points.length; i += 2) {
                        const distance = Math.sqrt(Math.pow(points[i].x - points[i - 1].x, 2)
                            + Math.pow(points[i].y - points[i - 1].y, 2));
                        result += Math.pow(distance - average, 2);
                    }

                    return result;
                }

                const processedSource = [];
                const processedTarget = [];

                const distances = computeDistances(source, target);
                const mapping = stableMarriageProblem(Array.from(source.keys()),
                    Array.from(target.keys()), distances);

                const average = (sumEdges(target)
                    + sumEdges(source)) / (target.length + source.length);
                const meanSquareDeviation = Math.sqrt((computeDeviation(source, average)
                    + computeDeviation(target, average)) / (source.length + target.length));
                const threshold = average + 3 * meanSquareDeviation; // 3 sigma rule
                truncateByThreshold(mapping, threshold);
                for (const key of Object.keys(mapping)) {
                    mapping[key] = mapping[key].value;
                }

                // const receivingOrder = Object.keys(mapping).map(x => +x).sort((a,b) => a - b);
                const receivingOrder = this.appendMapping(mapping, source, target);

                for (const pointIdx of receivingOrder) {
                    processedSource.push(source[pointIdx]);
                    processedTarget.push(target[mapping[pointIdx]]);
                }

                return [processedSource, processedTarget];
            }

            let leftBox = findBox(leftPosition.points);
            let rightBox = findBox(rightPosition.points);

            // Sometimes (if shape has one point or shape is line),
            // We can get box with zero area
            // Next computation will be with NaN in this case
            // We have to prevent it
            const delta = 1;
            if (leftBox.xmax - leftBox.xmin < delta || rightBox.ymax - rightBox.ymin < delta) {
                leftBox = {
                    xmin: 0,
                    xmax: 1024, // TODO: Get actual image size
                    ymin: 0,
                    ymax: 768,
                };

                rightBox = leftBox;
            }

            const leftPoints = toPoints(normalize(leftPosition.points, leftBox));
            const rightPoints = toPoints(normalize(rightPosition.points, rightBox));

            let newLeftPoints = [];
            let newRightPoints = [];
            if (leftPoints.length > rightPoints.length) {
                const [
                    processedRight,
                    processedLeft,
                ] = getMapping.call(this, rightPoints, leftPoints);
                newLeftPoints = processedLeft;
                newRightPoints = processedRight;
            } else {
                const [
                    processedLeft,
                    processedRight,
                ] = getMapping.call(this, leftPoints, rightPoints);
                newLeftPoints = processedLeft;
                newRightPoints = processedRight;
            }

            const absoluteLeftPoints = denormalize(toArray(newLeftPoints), leftBox);
            const absoluteRightPoints = denormalize(toArray(newRightPoints), rightBox);

            const interpolation = [];
            for (let i = 0; i < absoluteLeftPoints.length; i++) {
                interpolation.push(absoluteLeftPoints[i] + (
                    absoluteRightPoints[i] - absoluteLeftPoints[i]) * offset);
            }

            return {
                points: interpolation,
                occluded: leftPosition.occluded,
                outside: leftPosition.outside,
                zOrder: leftPosition.zOrder,
            };
        }

        // mapping is predicted order of points sourse_idx:target_idx
        // some points from source and target can absent in mapping
        // source, target - arrays of points. Target array size >= sourse array size
        appendMapping(mapping, source, target) {
            const targetMatched = Object.values(mapping).map((x) => +x);
            const sourceMatched = Object.keys(mapping).map((x) => +x);
            const orderForReceive = [];

            function findNeighbors(point) {
                let prev = point;
                let next = point;

                if (!targetMatched.length) {
                    // Prevent infinity loop
                    throw new ScriptingError('Interpolation mapping is empty');
                }

                while (!targetMatched.includes(prev)) {
                    prev--;
                    if (prev < 0) {
                        prev = target.length - 1;
                    }
                }

                while (!targetMatched.includes(next)) {
                    next++;
                    if (next >= target.length) {
                        next = 0;
                    }
                }

                return [prev, next];
            }

            function computeOffset(point, prev, next) {
                const pathPoints = [];

                while (prev !== next) {
                    pathPoints.push(target[prev]);
                    prev++;
                    if (prev >= target.length) {
                        prev = 0;
                    }
                }
                pathPoints.push(target[next]);

                let curveLength = 0;
                let offset = 0;
                let iCrossed = false;
                for (let k = 1; k < pathPoints.length; k++) {
                    const p1 = pathPoints[k];
                    const p2 = pathPoints[k - 1];
                    const distance = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));

                    if (!iCrossed) {
                        offset += distance;
                    }
                    curveLength += distance;
                    if (target[point] === pathPoints[k]) {
                        iCrossed = true;
                    }
                }

                if (!curveLength) {
                    return 0;
                }

                return offset / curveLength;
            }

            for (let i = 0; i < target.length; i++) {
                const index = targetMatched.indexOf(i);
                if (index === -1) {
                    // We have to find a neighbours which have been mapped
                    const [prev, next] = findNeighbors(i);

                    // Now compute edge offset
                    const offset = computeOffset(i, prev, next);

                    // Get point between two neighbors points
                    const prevPoint = target[prev];
                    const nextPoint = target[next];
                    const autoPoint = {
                        x: prevPoint.x + (nextPoint.x - prevPoint.x) * offset,
                        y: prevPoint.y + (nextPoint.y - prevPoint.y) * offset,
                    };

                    // Put it into matched
                    source.push(autoPoint);
                    mapping[source.length - 1] = i;
                    orderForReceive.push(source.length - 1);
                } else {
                    orderForReceive.push(sourceMatched[index]);
                }
            }

            return orderForReceive;
        }
    }

    class PolygonTrack extends PolyTrack {
        constructor(data, clientID, color, injection) {
            super(data, clientID, color, injection);
            this.shapeType = ObjectShape.POLYGON;
            for (const shape of Object.values(this.shapes)) {
                checkNumberOfPoints(this.shapeType, shape.points);
            }
        }
    }

    class PolylineTrack extends PolyTrack {
        constructor(data, clientID, color, injection) {
            super(data, clientID, color, injection);
            this.shapeType = ObjectShape.POLYLINE;
            for (const shape of Object.values(this.shapes)) {
                checkNumberOfPoints(this.shapeType, shape.points);
            }
        }
    }

    class PointsTrack extends PolyTrack {
        constructor(data, clientID, color, injection) {
            super(data, clientID, color, injection);
            this.shapeType = ObjectShape.POINTS;
            for (const shape of Object.values(this.shapes)) {
                checkNumberOfPoints(this.shapeType, shape.points);
            }
        }
    }

    RectangleTrack.distance = RectangleShape.distance;
    PolygonTrack.distance = PolygonShape.distance;
    PolylineTrack.distance = PolylineShape.distance;
    PointsTrack.distance = PointsShape.distance;

    module.exports = {
        RectangleShape,
        PolygonShape,
        PolylineShape,
        PointsShape,
        RectangleTrack,
        PolygonTrack,
        PolylineTrack,
        PointsTrack,
        Track,
        Shape,
        Tag,
        objectStateFactory,
    };
})();
