// Copyright (C) 2020 Intel Corporation
//
// SPDX-License-Identifier: MIT

import './styles.scss';
import React from 'react';

import {
    Layout,
} from 'antd';

import CanvasWrapperContainer from 'containers/annotation-page/standard-workspace/canvas-wrapper';
import ControlsSideBarContainer from 'containers/annotation-page/standard-workspace/controls-side-bar/controls-side-bar';
import ObjectSideBarContainer from 'containers/annotation-page/standard-workspace/objects-side-bar/objects-side-bar';
import PropagateConfirmContainer from 'containers/annotation-page/standard-workspace/propagate-confirm';
import CanvasContextMenuContainer from 'containers/annotation-page/standard-workspace/canvas-context-menu';

export default function StandardWorkspaceComponent(): JSX.Element {
    return (
        <Layout hasSider>
            <ControlsSideBarContainer />
            <CanvasWrapperContainer />
            <ObjectSideBarContainer />
            <PropagateConfirmContainer />
            <CanvasContextMenuContainer />
        </Layout>
    );
}
