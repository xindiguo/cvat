
# Copyright (C) 2019 Intel Corporation
#
# SPDX-License-Identifier: MIT

import os
import os.path as osp

from datumaro.components.formats.voc import VocTask, VocPath
from datumaro.util import find


class VocImporter:
    _TASKS = [
        (VocTask.classification, 'voc_cls', 'Main'),
        (VocTask.detection, 'voc_det', 'Main'),
        (VocTask.segmentation, 'voc_segm', 'Segmentation'),
        (VocTask.person_layout, 'voc_layout', 'Layout'),
        (VocTask.action_classification, 'voc_action', 'Action'),
    ]

    def __call__(self, path, **extra_params):
        from datumaro.components.project import Project # cyclic import
        project = Project()

        for task, extractor_type, task_dir in self._TASKS:
            task_dir = osp.join(path, VocPath.SUBSETS_DIR, task_dir)
            if not osp.isdir(task_dir):
                continue

            project.add_source(task.name, {
                'url': path,
                'format': extractor_type,
                'options': dict(extra_params),
            })

        if len(project.config.sources) == 0:
            raise Exception("Failed to find 'voc' dataset at '%s'" % path)

        return project


class VocResultsImporter:
    _TASKS = [
        ('comp1', 'voc_comp_1_2', 'Main'),
        ('comp2', 'voc_comp_1_2', 'Main'),
        ('comp3', 'voc_comp_3_4', 'Main'),
        ('comp4', 'voc_comp_3_4', 'Main'),
        ('comp5', 'voc_comp_5_6', 'Segmentation'),
        ('comp6', 'voc_comp_5_6', 'Segmentation'),
        ('comp7', 'voc_comp_7_8', 'Layout'),
        ('comp8', 'voc_comp_7_8', 'Layout'),
        ('comp9', 'voc_comp_9_10', 'Action'),
        ('comp10', 'voc_comp_9_10', 'Action'),
    ]

    def __call__(self, path, **extra_params):
        from datumaro.components.project import Project # cyclic import
        project = Project()

        for task_name, extractor_type, task_dir in self._TASKS:
            task_dir = osp.join(path, task_dir)
            if not osp.isdir(task_dir):
                continue
            dir_items = os.listdir(task_dir)
            if not find(dir_items, lambda x: x == task_name):
                continue

            project.add_source(task_name, {
                'url': task_dir,
                'format': extractor_type,
                'options': dict(extra_params),
            })

        if len(project.config.sources) == 0:
            raise Exception("Failed to find 'voc_results' dataset at '%s'" % \
                path)

        return project