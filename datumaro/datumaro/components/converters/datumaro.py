
# Copyright (C) 2019 Intel Corporation
#
# SPDX-License-Identifier: MIT

# pylint: disable=no-self-use

import json
import os
import os.path as osp

from datumaro.components.converter import Converter
from datumaro.components.extractor import (
    DEFAULT_SUBSET_NAME, Annotation,
    LabelObject, MaskObject, PointsObject, PolygonObject,
    PolyLineObject, BboxObject, CaptionObject,
    LabelCategories, MaskCategories, PointsCategories
)
from datumaro.components.formats.datumaro import DatumaroPath
from datumaro.util.image import save_image


def _cast(value, type_conv, default=None):
    if value is None:
        return default
    try:
        return type_conv(value)
    except Exception:
        return default

class _SubsetWriter:
    def __init__(self, name, converter):
        self._name = name
        self._converter = converter

        self._data = {
            'info': {},
            'categories': {},
            'items': [],
        }

        self._next_mask_id = 1

    @property
    def categories(self):
        return self._data['categories']

    @property
    def items(self):
        return self._data['items']

    def write_item(self, item):
        annotations = []
        item_desc = {
            'id': item.id,
            'annotations': annotations,
        }
        if item.path:
            item_desc['path'] = item.path
        self.items.append(item_desc)

        for ann in item.annotations:
            if isinstance(ann, LabelObject):
                converted_ann = self._convert_label_object(ann)
            elif isinstance(ann, MaskObject):
                converted_ann = self._convert_mask_object(ann)
            elif isinstance(ann, PointsObject):
                converted_ann = self._convert_points_object(ann)
            elif isinstance(ann, PolyLineObject):
                converted_ann = self._convert_polyline_object(ann)
            elif isinstance(ann, PolygonObject):
                converted_ann = self._convert_polygon_object(ann)
            elif isinstance(ann, BboxObject):
                converted_ann = self._convert_bbox_object(ann)
            elif isinstance(ann, CaptionObject):
                converted_ann = self._convert_caption_object(ann)
            else:
                raise NotImplementedError()
            annotations.append(converted_ann)

    def write_categories(self, categories):
        for ann_type, desc in categories.items():
            if isinstance(desc, LabelCategories):
                converted_desc = self._convert_label_categories(desc)
            elif isinstance(desc, MaskCategories):
                converted_desc = self._convert_mask_categories(desc)
            elif isinstance(desc, PointsCategories):
                converted_desc = self._convert_points_categories(desc)
            else:
                raise NotImplementedError()
            self.categories[ann_type.name] = converted_desc

    def write(self, save_dir):
        with open(osp.join(save_dir, '%s.json' % (self._name)), 'w') as f:
            json.dump(self._data, f)

    def _convert_annotation(self, obj):
        assert isinstance(obj, Annotation)

        ann_json = {
            'id': _cast(obj.id, int),
            'type': _cast(obj.type.name, str),
            'attributes': obj.attributes,
            'group': _cast(obj.group, int, None),
        }
        return ann_json

    def _convert_label_object(self, obj):
        converted = self._convert_annotation(obj)

        converted.update({
            'label_id': _cast(obj.label, int),
        })
        return converted

    def _save_mask(self, mask):
        mask_id = None
        if mask is None:
            return mask_id

        mask_id = self._next_mask_id
        self._next_mask_id += 1

        filename = '%d%s' % (mask_id, DatumaroPath.MASK_EXT)
        masks_dir = osp.join(self._converter._annotations_dir,
            DatumaroPath.MASKS_DIR)
        os.makedirs(masks_dir, exist_ok=True)
        path = osp.join(masks_dir, filename)
        save_image(path, mask)
        return mask_id

    def _convert_mask_object(self, obj):
        converted = self._convert_annotation(obj)

        mask = obj.image
        mask_id = None
        if mask is not None:
            mask_id = self._save_mask(mask)

        converted.update({
            'label_id': _cast(obj.label, int),
            'mask_id': _cast(mask_id, int),
        })
        return converted

    def _convert_polyline_object(self, obj):
        converted = self._convert_annotation(obj)

        converted.update({
            'label_id': _cast(obj.label, int),
            'points': [float(p) for p in obj.get_points()],
        })
        return converted

    def _convert_polygon_object(self, obj):
        converted = self._convert_annotation(obj)

        converted.update({
            'label_id': _cast(obj.label, int),
            'points': [float(p) for p in obj.get_points()],
        })
        return converted

    def _convert_bbox_object(self, obj):
        converted = self._convert_annotation(obj)

        converted.update({
            'label_id': _cast(obj.label, int),
            'bbox': [float(p) for p in obj.get_bbox()],
        })
        return converted

    def _convert_points_object(self, obj):
        converted = self._convert_annotation(obj)

        converted.update({
            'label_id': _cast(obj.label, int),
            'points': [float(p) for p in obj.points],
            'visibility': [int(v.value) for v in obj.visibility],
        })
        return converted

    def _convert_caption_object(self, obj):
        converted = self._convert_annotation(obj)

        converted.update({
            'caption': _cast(obj.caption, str),
        })
        return converted

    def _convert_label_categories(self, obj):
        converted = {
            'labels': [],
        }
        for label in obj.items:
            converted['labels'].append({
                'name': _cast(label.name, str),
                'parent': _cast(label.parent, str),
            })
        return converted

    def _convert_mask_categories(self, obj):
        converted = {
            'colormap': [],
        }
        for label_id, color in obj.colormap.items():
            converted['colormap'].append({
                'label_id': int(label_id),
                'r': int(color[0]),
                'g': int(color[1]),
                'b': int(color[2]),
            })
        return converted

    def _convert_points_categories(self, obj):
        converted = {
            'items': [],
        }
        for label_id, item in obj.items.items():
            converted['items'].append({
                'label_id': int(label_id),
                'labels': [_cast(label, str) for label in item.labels],
                'adjacent': [int(v) for v in item.adjacent],
            })
        return converted

class _Converter:
    def __init__(self, extractor, save_dir, save_images=False,):
        self._extractor = extractor
        self._save_dir = save_dir
        self._save_images = save_images

    def convert(self):
        os.makedirs(self._save_dir, exist_ok=True)

        images_dir = osp.join(self._save_dir, DatumaroPath.IMAGES_DIR)
        os.makedirs(images_dir, exist_ok=True)
        self._images_dir = images_dir

        annotations_dir = osp.join(self._save_dir, DatumaroPath.ANNOTATIONS_DIR)
        os.makedirs(annotations_dir, exist_ok=True)
        self._annotations_dir = annotations_dir

        subsets = self._extractor.subsets()
        if len(subsets) == 0:
            subsets = [ None ]
        subsets = [n if n else DEFAULT_SUBSET_NAME for n in subsets]
        subsets = { name: _SubsetWriter(name, self) for name in subsets }

        for subset, writer in subsets.items():
            writer.write_categories(self._extractor.categories())

        for item in self._extractor:
            subset = item.subset
            if not subset:
                subset = DEFAULT_SUBSET_NAME
            writer = subsets[subset]

            if self._save_images:
                self._save_image(item)
            writer.write_item(item)

        for subset, writer in subsets.items():
            writer.write(annotations_dir)

    def _save_image(self, item):
        image = item.image
        if image is None:
            return

        image_path = osp.join(self._images_dir,
            str(item.id) + DatumaroPath.IMAGE_EXT)
        save_image(image_path, image)

class DatumaroConverter(Converter):
    def __init__(self, save_images=False, cmdline_args=None):
        super().__init__()

        self._options = {
            'save_images': save_images,
        }

        if cmdline_args is not None:
            self._options.update(self._parse_cmdline(cmdline_args))

    @classmethod
    def build_cmdline_parser(cls, parser=None):
        import argparse
        if not parser:
            parser = argparse.ArgumentParser(prog='datumaro')

        parser.add_argument('--save-images', action='store_true',
            help="Save images (default: %(default)s)")

        return parser

    def __call__(self, extractor, save_dir):
        converter = _Converter(extractor, save_dir, **self._options)
        converter.convert()