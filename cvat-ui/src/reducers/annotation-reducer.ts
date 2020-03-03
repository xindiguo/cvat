// Copyright (C) 2020 Intel Corporation
//
// SPDX-License-Identifier: MIT

import { AnyAction } from 'redux';

import { Canvas, CanvasMode } from 'cvat-canvas';
import { AnnotationActionTypes } from 'actions/annotation-actions';
import { AuthActionTypes } from 'actions/auth-actions';
import {
    AnnotationState,
    ActiveControl,
    ShapeType,
    ObjectType,
} from './interfaces';

const defaultState: AnnotationState = {
    activities: {
        loads: {},
    },
    canvas: {
        contextMenu: {
            visible: false,
            left: 0,
            top: 0,
        },
        instance: new Canvas(),
        ready: false,
        activeControl: ActiveControl.CURSOR,
    },
    job: {
        labels: [],
        instance: null,
        attributes: {},
        fetching: false,
        saving: false,
    },
    player: {
        frame: {
            number: 0,
            data: null,
            fetching: false,
            delay: 0,
            changeTime: null,
        },
        playing: false,
        frameAngles: [],
    },
    drawing: {
        activeShapeType: ShapeType.RECTANGLE,
        activeLabelID: 0,
        activeObjectType: ObjectType.SHAPE,
    },
    annotations: {
        selectedStatesID: [],
        activatedStateID: null,
        saving: {
            uploading: false,
            statuses: [],
        },
        collapsed: {},
        states: [],
        filters: [],
        filtersHistory: JSON.parse(window.localStorage.getItem('filtersHistory') as string) || [],
        history: {
            undo: [],
            redo: [],
        },
        zLayer: {
            min: 0,
            max: 0,
            cur: 0,
        },
    },
    propagate: {
        objectState: null,
        frames: 50,
    },
    statistics: {
        visible: false,
        collecting: false,
        data: null,
    },
    colors: [],
    sidebarCollapsed: false,
    appearanceCollapsed: false,
    tabContentHeight: 0,
};

export default (state = defaultState, action: AnyAction): AnnotationState => {
    switch (action.type) {
        case AnnotationActionTypes.GET_JOB: {
            return {
                ...state,
                job: {
                    ...state.job,
                    fetching: true,
                },
            };
        }
        case AnnotationActionTypes.GET_JOB_SUCCESS: {
            const {
                job,
                states,
                frameNumber: number,
                colors,
                filters,
                frameData: data,
                minZ,
                maxZ,
            } = action.payload;

            return {
                ...state,
                job: {
                    ...state.job,
                    fetching: false,
                    instance: job,
                    labels: job.task.labels,
                    attributes: job.task.labels
                        .reduce((acc: Record<number, any[]>, label: any): Record<number, any[]> => {
                            acc[label.id] = label.attributes;
                            return acc;
                        }, {}),
                },
                annotations: {
                    ...state.annotations,
                    states,
                    filters,
                    zLayer: {
                        min: minZ,
                        max: maxZ,
                        cur: maxZ,
                    },
                },
                player: {
                    ...state.player,
                    frame: {
                        ...state.player.frame,
                        number,
                        data,
                    },
                    frameAngles: Array(job.stopFrame - job.startFrame + 1).fill(0),
                },
                drawing: {
                    ...state.drawing,
                    activeLabelID: job.task.labels[0].id,
                    activeObjectType: job.task.mode === 'interpolation' ? ObjectType.TRACK : ObjectType.SHAPE,
                },
                colors,
            };
        }
        case AnnotationActionTypes.GET_JOB_FAILED: {
            return {
                ...state,
                job: {
                    ...state.job,
                    instance: undefined,
                    fetching: false,
                },
            };
        }
        case AnnotationActionTypes.CLOSE_JOB: {
            return {
                ...defaultState,
                canvas: {
                    ...defaultState.canvas,
                    instance: new Canvas(),
                },
            };
        }
        case AnnotationActionTypes.CHANGE_FRAME: {
            return {
                ...state,
                player: {
                    ...state.player,
                    frame: {
                        ...state.player.frame,
                        fetching: true,
                    },
                },
                canvas: {
                    ...state.canvas,
                    ready: false,
                },
            };
        }
        case AnnotationActionTypes.CHANGE_FRAME_SUCCESS: {
            const {
                number,
                data,
                states,
                minZ,
                maxZ,
                delay,
                changeTime,
            } = action.payload;

            const activatedStateID = states
                .map((_state: any) => _state.clientID).includes(state.annotations.activatedStateID)
                ? state.annotations.activatedStateID : null;

            return {
                ...state,
                player: {
                    ...state.player,
                    frame: {
                        data,
                        number,
                        fetching: false,
                        changeTime,
                        delay,
                    },
                },
                annotations: {
                    ...state.annotations,
                    activatedStateID,
                    states,
                    zLayer: {
                        min: minZ,
                        max: maxZ,
                        cur: maxZ,
                    },
                },
            };
        }
        case AnnotationActionTypes.CHANGE_FRAME_FAILED: {
            return {
                ...state,
                player: {
                    ...state.player,
                    frame: {
                        ...state.player.frame,
                        fetching: false,
                    },
                },
            };
        }
        case AnnotationActionTypes.ROTATE_FRAME: {
            const { offset, angle, rotateAll } = action.payload;
            return {
                ...state,
                player: {
                    ...state.player,
                    frameAngles: state.player.frameAngles.map((_angle: number, idx: number) => (
                        rotateAll || offset === idx ? angle : _angle)),
                },
            };
        }
        case AnnotationActionTypes.SAVE_ANNOTATIONS: {
            return {
                ...state,
                annotations: {
                    ...state.annotations,
                    saving: {
                        ...state.annotations.saving,
                        uploading: true,
                        statuses: [],
                    },
                },
            };
        }
        case AnnotationActionTypes.SAVE_ANNOTATIONS_SUCCESS: {
            return {
                ...state,
                annotations: {
                    ...state.annotations,
                    saving: {
                        ...state.annotations.saving,
                        uploading: false,
                    },
                },
            };
        }
        case AnnotationActionTypes.SAVE_ANNOTATIONS_FAILED: {
            return {
                ...state,
                annotations: {
                    ...state.annotations,
                    saving: {
                        ...state.annotations.saving,
                        uploading: false,
                    },
                },
            };
        }
        case AnnotationActionTypes.SAVE_UPDATE_ANNOTATIONS_STATUS: {
            const { status } = action.payload;

            return {
                ...state,
                annotations: {
                    ...state.annotations,
                    saving: {
                        ...state.annotations.saving,
                        statuses: [...state.annotations.saving.statuses, status],
                    },
                },
            };
        }
        case AnnotationActionTypes.SWITCH_PLAY: {
            const { playing } = action.payload;

            return {
                ...state,
                player: {
                    ...state.player,
                    playing,
                },
            };
        }
        case AnnotationActionTypes.COLLAPSE_SIDEBAR: {
            return {
                ...state,
                sidebarCollapsed: !state.sidebarCollapsed,
            };
        }
        case AnnotationActionTypes.COLLAPSE_APPEARANCE: {
            return {
                ...state,
                appearanceCollapsed: !state.appearanceCollapsed,
            };
        }
        case AnnotationActionTypes.UPDATE_TAB_CONTENT_HEIGHT: {
            const { tabContentHeight } = action.payload;
            return {
                ...state,
                tabContentHeight,
            };
        }
        case AnnotationActionTypes.COLLAPSE_OBJECT_ITEMS: {
            const {
                states,
                collapsed,
            } = action.payload;

            const updatedCollapsedStates = { ...state.annotations.collapsed };
            for (const objectState of states) {
                updatedCollapsedStates[objectState.clientID] = collapsed;
            }

            return {
                ...state,
                annotations: {
                    ...state.annotations,
                    collapsed: updatedCollapsedStates,
                },
            };
        }
        case AnnotationActionTypes.CONFIRM_CANVAS_READY: {
            return {
                ...state,
                canvas: {
                    ...state.canvas,
                    ready: true,
                },
            };
        }
        case AnnotationActionTypes.DRAG_CANVAS: {
            const { enabled } = action.payload;
            const activeControl = enabled
                ? ActiveControl.DRAG_CANVAS : ActiveControl.CURSOR;

            return {
                ...state,
                annotations: {
                    ...state.annotations,
                    activatedStateID: null,
                },
                canvas: {
                    ...state.canvas,
                    activeControl,
                },
            };
        }
        case AnnotationActionTypes.ZOOM_CANVAS: {
            const { enabled } = action.payload;
            const activeControl = enabled
                ? ActiveControl.ZOOM_CANVAS : ActiveControl.CURSOR;

            return {
                ...state,
                annotations: {
                    ...state.annotations,
                    activatedStateID: null,
                },
                canvas: {
                    ...state.canvas,
                    activeControl,
                },
            };
        }
        case AnnotationActionTypes.DRAW_SHAPE: {
            const {
                shapeType,
                labelID,
                objectType,
                points,
                activeControl,
                rectDrawingMethod,
            } = action.payload;

            return {
                ...state,
                annotations: {
                    ...state.annotations,
                    activatedStateID: null,
                },
                canvas: {
                    ...state.canvas,
                    activeControl,
                },
                drawing: {
                    activeLabelID: labelID,
                    activeNumOfPoints: points,
                    activeObjectType: objectType,
                    activeShapeType: shapeType,
                    activeRectDrawingMethod: rectDrawingMethod,
                },
            };
        }
        case AnnotationActionTypes.MERGE_OBJECTS: {
            const { enabled } = action.payload;
            const activeControl = enabled
                ? ActiveControl.MERGE : ActiveControl.CURSOR;

            return {
                ...state,
                annotations: {
                    ...state.annotations,
                    activatedStateID: null,
                },
                canvas: {
                    ...state.canvas,
                    activeControl,
                },
            };
        }
        case AnnotationActionTypes.GROUP_OBJECTS: {
            const { enabled } = action.payload;
            const activeControl = enabled
                ? ActiveControl.GROUP : ActiveControl.CURSOR;

            return {
                ...state,
                annotations: {
                    ...state.annotations,
                    activatedStateID: null,
                },
                canvas: {
                    ...state.canvas,
                    activeControl,
                },
            };
        }
        case AnnotationActionTypes.SPLIT_TRACK: {
            const { enabled } = action.payload;
            const activeControl = enabled
                ? ActiveControl.SPLIT : ActiveControl.CURSOR;

            return {
                ...state,
                annotations: {
                    ...state.annotations,
                    activatedStateID: null,
                },
                canvas: {
                    ...state.canvas,
                    activeControl,
                },
            };
        }
        case AnnotationActionTypes.SHAPE_DRAWN: {
            return {
                ...state,
                canvas: {
                    ...state.canvas,
                    activeControl: ActiveControl.CURSOR,
                },
            };
        }
        case AnnotationActionTypes.UPDATE_ANNOTATIONS_SUCCESS: {
            const {
                history,
                states: updatedStates,
                minZ,
                maxZ,
            } = action.payload;
            const { states: prevStates } = state.annotations;
            const nextStates = [...prevStates];

            const clientIDs = prevStates.map((prevState: any): number => prevState.clientID);
            for (const updatedState of updatedStates) {
                const index = clientIDs.indexOf(updatedState.clientID);
                if (index !== -1) {
                    nextStates[index] = updatedState;
                }
            }

            const maxZLayer = Math.max(state.annotations.zLayer.max, maxZ);
            const minZLayer = Math.min(state.annotations.zLayer.min, minZ);

            return {
                ...state,
                annotations: {
                    ...state.annotations,
                    zLayer: {
                        min: minZLayer,
                        max: maxZLayer,
                        cur: maxZLayer,
                    },
                    states: nextStates,
                    history,
                },
            };
        }
        case AnnotationActionTypes.UPDATE_ANNOTATIONS_FAILED: {
            const { states } = action.payload;
            return {
                ...state,
                annotations: {
                    ...state.annotations,
                    states,
                },
            };
        }
        case AnnotationActionTypes.CREATE_ANNOTATIONS_SUCCESS: {
            const {
                states,
                history,
            } = action.payload;

            return {
                ...state,
                annotations: {
                    ...state.annotations,
                    states,
                    history,
                },
            };
        }
        case AnnotationActionTypes.MERGE_ANNOTATIONS_SUCCESS: {
            const {
                states,
                history,
            } = action.payload;

            return {
                ...state,
                annotations: {
                    ...state.annotations,
                    states,
                    history,
                },
            };
        }
        case AnnotationActionTypes.GROUP_ANNOTATIONS_SUCCESS: {
            const {
                states,
                history,
            } = action.payload;

            return {
                ...state,
                annotations: {
                    ...state.annotations,
                    states,
                    history,
                },
            };
        }
        case AnnotationActionTypes.SPLIT_ANNOTATIONS_SUCCESS: {
            const {
                states,
                history,
            } = action.payload;

            return {
                ...state,
                annotations: {
                    ...state.annotations,
                    states,
                    history,
                },
            };
        }
        case AnnotationActionTypes.CHANGE_LABEL_COLOR_SUCCESS: {
            const {
                label,
                states,
                history,
            } = action.payload;

            const { instance: job } = state.job;
            const labels = [...job.task.labels];
            const index = labels.indexOf(label);
            labels[index] = label;

            return {
                ...state,
                job: {
                    ...state.job,
                    labels,
                },
                annotations: {
                    ...state.annotations,
                    states,
                    history,
                },
            };
        }
        case AnnotationActionTypes.ACTIVATE_OBJECT: {
            const { activatedStateID } = action.payload;
            const {
                canvas: {
                    activeControl,
                    instance,
                },
            } = state;

            if (activeControl !== ActiveControl.CURSOR || instance.mode() !== CanvasMode.IDLE) {
                return state;
            }

            return {
                ...state,
                annotations: {
                    ...state.annotations,
                    activatedStateID,
                },
            };
        }
        case AnnotationActionTypes.SELECT_OBJECTS: {
            const {
                selectedStatesID,
            } = action.payload;

            return {
                ...state,
                annotations: {
                    ...state.annotations,
                    selectedStatesID,
                },
            };
        }
        case AnnotationActionTypes.REMOVE_OBJECT_SUCCESS: {
            const {
                objectState,
                history,
            } = action.payload;

            return {
                ...state,
                annotations: {
                    ...state.annotations,
                    history,
                    activatedStateID: null,
                    states: state.annotations.states
                        .filter((_objectState: any) => (
                            _objectState.clientID !== objectState.clientID
                        )),
                },
            };
        }
        case AnnotationActionTypes.COPY_SHAPE: {
            const {
                objectState,
            } = action.payload;

            state.canvas.instance.cancel();
            state.canvas.instance.draw({
                enabled: true,
                initialState: objectState,
            });

            let activeControl = ActiveControl.DRAW_RECTANGLE;
            if (objectState.shapeType === ShapeType.POINTS) {
                activeControl = ActiveControl.DRAW_POINTS;
            } else if (objectState.shapeType === ShapeType.POLYGON) {
                activeControl = ActiveControl.DRAW_POLYGON;
            } else if (objectState.shapeType === ShapeType.POLYLINE) {
                activeControl = ActiveControl.DRAW_POLYLINE;
            }

            return {
                ...state,
                canvas: {
                    ...state.canvas,
                    activeControl,
                },
                annotations: {
                    ...state.annotations,
                    activatedStateID: null,
                },
            };
        }
        case AnnotationActionTypes.EDIT_SHAPE: {
            const { enabled } = action.payload;
            const activeControl = enabled
                ? ActiveControl.EDIT : ActiveControl.CURSOR;

            return {
                ...state,
                canvas: {
                    ...state.canvas,
                    activeControl,
                },
            };
        }
        case AnnotationActionTypes.PROPAGATE_OBJECT: {
            const { objectState } = action.payload;
            return {
                ...state,
                propagate: {
                    ...state.propagate,
                    objectState,
                },
            };
        }
        case AnnotationActionTypes.PROPAGATE_OBJECT_SUCCESS: {
            const { history } = action.payload;
            return {
                ...state,
                annotations: {
                    ...state.annotations,
                    history,
                },
                propagate: {
                    ...state.propagate,
                    objectState: null,
                },
            };
        }
        case AnnotationActionTypes.CHANGE_PROPAGATE_FRAMES: {
            const { frames } = action.payload;

            return {
                ...state,
                propagate: {
                    ...state.propagate,
                    frames,
                },
            };
        }
        case AnnotationActionTypes.SWITCH_SHOWING_STATISTICS: {
            const { visible } = action.payload;

            return {
                ...state,
                statistics: {
                    ...state.statistics,
                    visible,
                },
            };
        }
        case AnnotationActionTypes.COLLECT_STATISTICS: {
            return {
                ...state,
                statistics: {
                    ...state.statistics,
                    collecting: true,
                },
            };
        }
        case AnnotationActionTypes.COLLECT_STATISTICS_SUCCESS: {
            const { data } = action.payload;
            return {
                ...state,
                statistics: {
                    ...state.statistics,
                    collecting: false,
                    data,
                },
            };
        }
        case AnnotationActionTypes.COLLECT_STATISTICS_FAILED: {
            return {
                ...state,
                statistics: {
                    ...state.statistics,
                    collecting: false,
                    data: null,
                },
            };
        }
        case AnnotationActionTypes.CHANGE_JOB_STATUS: {
            return {
                ...state,
                job: {
                    ...state.job,
                    saving: true,
                },
            };
        }
        case AnnotationActionTypes.CHANGE_JOB_STATUS_SUCCESS: {
            return {
                ...state,
                job: {
                    ...state.job,
                    saving: false,
                },
            };
        }
        case AnnotationActionTypes.CHANGE_JOB_STATUS_FAILED: {
            return {
                ...state,
                job: {
                    ...state.job,
                    saving: false,
                },
            };
        }
        case AnnotationActionTypes.UPLOAD_JOB_ANNOTATIONS: {
            const {
                job,
                loader,
            } = action.payload;
            const { loads } = state.activities;
            loads[job.id] = job.id in loads ? loads[job.id] : loader.name;

            return {
                ...state,
                activities: {
                    ...state.activities,
                    loads: {
                        ...loads,
                    },
                },
            };
        }
        case AnnotationActionTypes.UPLOAD_JOB_ANNOTATIONS_FAILED: {
            const { job } = action.payload;
            const { loads } = state.activities;

            delete loads[job.id];

            return {
                ...state,
                activities: {
                    ...state.activities,
                    loads: {
                        ...loads,
                    },
                },
            };
        }
        case AnnotationActionTypes.UPLOAD_JOB_ANNOTATIONS_SUCCESS: {
            const {
                states,
                job,
                history,
            } = action.payload;
            const { loads } = state.activities;

            delete loads[job.id];

            return {
                ...state,
                activities: {
                    ...state.activities,
                    loads: {
                        ...loads,
                    },
                },
                annotations: {
                    ...state.annotations,
                    history,
                    states,
                    selectedStatesID: [],
                    activatedStateID: null,
                    collapsed: {},
                },
            };
        }
        case AnnotationActionTypes.REMOVE_JOB_ANNOTATIONS_SUCCESS: {
            const { history } = action.payload;
            return {
                ...state,
                annotations: {
                    ...state.annotations,
                    history,
                    selectedStatesID: [],
                    activatedStateID: null,
                    collapsed: {},
                    states: [],
                },
            };
        }
        case AnnotationActionTypes.UPDATE_CANVAS_CONTEXT_MENU: {
            const {
                visible,
                left,
                top,
            } = action.payload;

            return {
                ...state,
                canvas: {
                    ...state.canvas,
                    contextMenu: {
                        ...state.canvas.contextMenu,
                        visible,
                        left,
                        top,
                    },
                },
            };
        }
        case AnnotationActionTypes.REDO_ACTION_SUCCESS:
        case AnnotationActionTypes.UNDO_ACTION_SUCCESS: {
            const {
                history,
                states,
                minZ,
                maxZ,
            } = action.payload;

            const activatedStateID = states
                .map((_state: any) => _state.clientID).includes(state.annotations.activatedStateID)
                ? state.annotations.activatedStateID : null;

            return {
                ...state,
                annotations: {
                    ...state.annotations,
                    activatedStateID,
                    states,
                    history,
                    zLayer: {
                        min: minZ,
                        max: maxZ,
                        cur: maxZ,
                    },
                },
            };
        }
        case AnnotationActionTypes.FETCH_ANNOTATIONS_SUCCESS: {
            const { states, minZ, maxZ } = action.payload;
            const activatedStateID = states
                .map((_state: any) => _state.clientID).includes(state.annotations.activatedStateID)
                ? state.annotations.activatedStateID : null;

            return {
                ...state,
                annotations: {
                    ...state.annotations,
                    activatedStateID,
                    states,
                    zLayer: {
                        min: minZ,
                        max: maxZ,
                        cur: maxZ,
                    },
                },
            };
        }
        case AnnotationActionTypes.CHANGE_ANNOTATIONS_FILTERS: {
            const { filters, filtersHistory } = action.payload;

            return {
                ...state,
                annotations: {
                    ...state.annotations,
                    filtersHistory,
                    filters,
                },
            };
        }
        case AnnotationActionTypes.SWITCH_Z_LAYER: {
            const { cur } = action.payload;
            const { max, min } = state.annotations.zLayer;

            let { activatedStateID } = state.annotations;
            if (activatedStateID !== null) {
                const idx = state.annotations.states
                    .map((_state: any) => _state.clientID).indexOf(activatedStateID);
                if (idx !== -1) {
                    if (state.annotations.states[idx].zOrder > cur) {
                        activatedStateID = null;
                    }
                } else {
                    activatedStateID = null;
                }
            }

            return {
                ...state,
                annotations: {
                    ...state.annotations,
                    activatedStateID,
                    zLayer: {
                        ...state.annotations.zLayer,
                        cur: Math.max(Math.min(cur, max), min),
                    },
                },
            };
        }
        case AnnotationActionTypes.ADD_Z_LAYER: {
            const { max } = state.annotations.zLayer;
            return {
                ...state,
                annotations: {
                    ...state.annotations,
                    zLayer: {
                        ...state.annotations.zLayer,
                        max: max + 1,
                        cur: max + 1,
                    },
                },
            };
        }
        case AnnotationActionTypes.RESET_CANVAS: {
            return {
                ...state,
                canvas: {
                    ...state.canvas,
                    activeControl: ActiveControl.CURSOR,
                },
            };
        }
        case AuthActionTypes.LOGOUT_SUCCESS: {
            return {
                ...defaultState,
            };
        }
        default: {
            return state;
        }
    }
};
