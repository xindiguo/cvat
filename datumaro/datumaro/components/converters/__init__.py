
# Copyright (C) 2019 Intel Corporation
#
# SPDX-License-Identifier: MIT

from datumaro.components.converters.datumaro import DatumaroConverter

from datumaro.components.converters.coco import (
    CocoConverter,
    CocoImageInfoConverter,
    CocoCaptionsConverter,
    CocoInstancesConverter,
    CocoPersonKeypointsConverter,
    CocoLabelsConverter,
)

from datumaro.components.converters.voc import (
    VocConverter,
    VocClassificationConverter,
    VocDetectionConverter,
    VocLayoutConverter,
    VocActionConverter,
    VocSegmentationConverter,
)

from datumaro.components.converters.yolo import YoloConverter
from datumaro.components.converters.tfrecord import DetectionApiConverter
from datumaro.components.converters.cvat import CvatConverter


items = [
    ('datumaro', DatumaroConverter),

    ('coco', CocoConverter),
    ('coco_images', CocoImageInfoConverter),
    ('coco_captions', CocoCaptionsConverter),
    ('coco_instances', CocoInstancesConverter),
    ('coco_person_kp', CocoPersonKeypointsConverter),
    ('coco_labels', CocoLabelsConverter),

    ('voc', VocConverter),
    ('voc_cls', VocClassificationConverter),
    ('voc_det', VocDetectionConverter),
    ('voc_segm', VocSegmentationConverter),
    ('voc_action', VocActionConverter),
    ('voc_layout', VocLayoutConverter),

    ('yolo', YoloConverter),

    ('tf_detection_api', DetectionApiConverter),

    ('cvat', CvatConverter),
]
