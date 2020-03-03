/*
* Copyright (C) 2019-2020 Intel Corporation
* SPDX-License-Identifier: MIT
*/

(() => {
    /**
        * Share files types
        * @enum {string}
        * @name ShareFileType
        * @memberof module:API.cvat.enums
        * @property {string} DIR 'DIR'
        * @property {string} REG 'REG'
        * @readonly
    */
    const ShareFileType = Object.freeze({
        DIR: 'DIR',
        REG: 'REG',
    });

    /**
        * Task statuses
        * @enum {string}
        * @name TaskStatus
        * @memberof module:API.cvat.enums
        * @property {string} ANNOTATION 'annotation'
        * @property {string} VALIDATION 'validation'
        * @property {string} COMPLETED 'completed'
        * @readonly
    */
    const TaskStatus = Object.freeze({
        ANNOTATION: 'annotation',
        VALIDATION: 'validation',
        COMPLETED: 'completed',
    });

    /**
        * Task modes
        * @enum {string}
        * @name TaskMode
        * @memberof module:API.cvat.enums
        * @property {string} ANNOTATION 'annotation'
        * @property {string} INTERPOLATION 'interpolation'
        * @readonly
    */
    const TaskMode = Object.freeze({
        ANNOTATION: 'annotation',
        INTERPOLATION: 'interpolation',
    });

    /**
        * Attribute types
        * @enum {string}
        * @name AttributeType
        * @memberof module:API.cvat.enums
        * @property {string} CHECKBOX 'checkbox'
        * @property {string} SELECT 'select'
        * @property {string} RADIO 'radio'
        * @property {string} NUMBER 'number'
        * @property {string} TEXT 'text'
        * @readonly
    */
    const AttributeType = Object.freeze({
        CHECKBOX: 'checkbox',
        RADIO: 'radio',
        SELECT: 'select',
        NUMBER: 'number',
        TEXT: 'text',
    });

    /**
        * Object types
        * @enum {string}
        * @name ObjectType
        * @memberof module:API.cvat.enums
        * @property {string} TAG 'tag'
        * @property {string} SHAPE 'shape'
        * @property {string} TRACK 'track'
        * @readonly
    */
    const ObjectType = Object.freeze({
        TAG: 'tag',
        SHAPE: 'shape',
        TRACK: 'track',
    });

    /**
        * Object shapes
        * @enum {string}
        * @name ObjectShape
        * @memberof module:API.cvat.enums
        * @property {string} RECTANGLE 'rectangle'
        * @property {string} POLYGON 'polygon'
        * @property {string} POLYLINE 'polyline'
        * @property {string} POINTS 'points'
        * @readonly
    */
    const ObjectShape = Object.freeze({
        RECTANGLE: 'rectangle',
        POLYGON: 'polygon',
        POLYLINE: 'polyline',
        POINTS: 'points',
    });

    /**
        * Event types
        * @enum {number}
        * @name LogType
        * @memberof module:API.cvat.enums
        * @property {number} pasteObject 0
        * @property {number} changeAttribute 1
        * @property {number} dragObject 2
        * @property {number} deleteObject 3
        * @property {number} pressShortcut 4
        * @property {number} resizeObject 5
        * @property {number} sendLogs 6
        * @property {number} saveJob 7
        * @property {number} jumpFrame 8
        * @property {number} drawObject 9
        * @property {number} changeLabel 10
        * @property {number} sendTaskInfo 11
        * @property {number} loadJob 12
        * @property {number} moveImage 13
        * @property {number} zoomImage 14
        * @property {number} lockObject 15
        * @property {number} mergeObjects 16
        * @property {number} copyObject 17
        * @property {number} propagateObject 18
        * @property {number} undoAction 19
        * @property {number} redoAction 20
        * @property {number} sendUserActivity 21
        * @property {number} sendException 22
        * @property {number} changeFrame 23
        * @property {number} debugInfo 24
        * @property {number} fitImage 25
        * @property {number} rotateImage 26
        * @readonly
    */
    const LogType = {
        pasteObject: 0,
        changeAttribute: 1,
        dragObject: 2,
        deleteObject: 3,
        pressShortcut: 4,
        resizeObject: 5,
        sendLogs: 6,
        saveJob: 7,
        jumpFrame: 8,
        drawObject: 9,
        changeLabel: 10,
        sendTaskInfo: 11,
        loadJob: 12,
        moveImage: 13,
        zoomImage: 14,
        lockObject: 15,
        mergeObjects: 16,
        copyObject: 17,
        propagateObject: 18,
        undoAction: 19,
        redoAction: 20,
        sendUserActivity: 21,
        sendException: 22,
        changeFrame: 23,
        debugInfo: 24,
        fitImage: 25,
        rotateImage: 26,
    };

    /**
        * Types of actions with annotations
        * @enum {string}
        * @name HistoryActions
        * @memberof module:API.cvat.enums
        * @property {string} CHANGED_LABEL Changed label
        * @property {string} CHANGED_ATTRIBUTES Changed attributes
        * @property {string} CHANGED_POINTS Changed points
        * @property {string} CHANGED_OUTSIDE Changed outside
        * @property {string} CHANGED_OCCLUDED Changed occluded
        * @property {string} CHANGED_ZORDER Changed z-order
        * @property {string} CHANGED_LOCK Changed lock
        * @property {string} CHANGED_COLOR Changed color
        * @property {string} CHANGED_HIDDEN Changed hidden
        * @property {string} MERGED_OBJECTS Merged objects
        * @property {string} SPLITTED_TRACK Splitted track
        * @property {string} GROUPED_OBJECTS Grouped objects
        * @property {string} CREATED_OBJECTS Created objects
        * @property {string} REMOVED_OBJECT Removed object
        * @readonly
    */
    const HistoryActions = Object.freeze({
        CHANGED_LABEL: 'Changed label',
        CHANGED_ATTRIBUTES: 'Changed attributes',
        CHANGED_POINTS: 'Changed points',
        CHANGED_OUTSIDE: 'Changed outside',
        CHANGED_OCCLUDED: 'Changed occluded',
        CHANGED_ZORDER: 'Changed z-order',
        CHANGED_KEYFRAME: 'Changed keyframe',
        CHANGED_LOCK: 'Changed lock',
        CHANGED_PINNED: 'Changed pinned',
        CHANGED_COLOR: 'Changed color',
        CHANGED_HIDDEN: 'Changed hidden',
        MERGED_OBJECTS: 'Merged objects',
        SPLITTED_TRACK: 'Splitted track',
        GROUPED_OBJECTS: 'Grouped objects',
        CREATED_OBJECTS: 'Created objects',
        REMOVED_OBJECT: 'Removed object',
    });

    /**
        * Array of hex colors
        * @type {module:API.cvat.classes.Loader[]} values
        * @name colors
        * @memberof module:API.cvat.enums
        * @type {string[]}
        * @readonly
    */
    const colors = [
        '#FF355E', '#E936A7', '#FD5B78', '#FF007C', '#FF00CC', '#66FF66',
        '#50BFE6', '#CCFF00', '#FFFF66', '#FF9966', '#FF6037', '#FFCC33',
        '#AAF0D1', '#FF3855', '#FFF700', '#A7F432', '#FF5470', '#FAFA37',
        '#FF7A00', '#FF9933', '#AFE313', '#00CC99', '#FF5050', '#733380',
    ];

    module.exports = {
        ShareFileType,
        TaskStatus,
        TaskMode,
        AttributeType,
        ObjectType,
        ObjectShape,
        LogType,
        HistoryActions,
        colors,
    };
})();
