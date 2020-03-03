// Copyright (C) 2020 Intel Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import { connect } from 'react-redux';

import { Canvas } from 'cvat-canvas';

import {
    mergeObjects,
    groupObjects,
    splitTrack,
    rotateCurrentFrame,
} from 'actions/annotation-actions';
import ControlsSideBarComponent from 'components/annotation-page/standard-workspace/controls-side-bar/controls-side-bar';
import {
    ActiveControl,
    CombinedState,
    Rotation,
} from 'reducers/interfaces';

interface StateToProps {
    canvasInstance: Canvas;
    rotateAll: boolean;
    activeControl: ActiveControl;
}

interface DispatchToProps {
    mergeObjects(enabled: boolean): void;
    groupObjects(enabled: boolean): void;
    splitTrack(enabled: boolean): void;
    rotateFrame(angle: Rotation): void;
}

function mapStateToProps(state: CombinedState): StateToProps {
    const {
        annotation: {
            canvas: {
                instance: canvasInstance,
                activeControl,
            },
        },
        settings: {
            player: {
                rotateAll,
            },
        },
    } = state;

    return {
        rotateAll,
        canvasInstance,
        activeControl,
    };
}

function dispatchToProps(dispatch: any): DispatchToProps {
    return {
        mergeObjects(enabled: boolean): void {
            dispatch(mergeObjects(enabled));
        },
        groupObjects(enabled: boolean): void {
            dispatch(groupObjects(enabled));
        },
        splitTrack(enabled: boolean): void {
            dispatch(splitTrack(enabled));
        },
        rotateFrame(rotation: Rotation): void {
            dispatch(rotateCurrentFrame(rotation));
        },
    };
}

function ControlsSideBarContainer(props: StateToProps & DispatchToProps): JSX.Element {
    return (
        <ControlsSideBarComponent {...props} />
    );
}

export default connect(
    mapStateToProps,
    dispatchToProps,
)(ControlsSideBarContainer);
