
# Copyright (C) 2019 Intel Corporation
#
# SPDX-License-Identifier: MIT

from collections import defaultdict
import os
import os.path as osp
from xml.etree import ElementTree as ET

from datumaro.components.extractor import (Extractor, DatasetItem,
    AnnotationType, LabelObject, MaskObject, BboxObject,
)
from datumaro.components.formats.voc import (
    VocTask, VocPath, VocInstColormap, parse_label_map, make_voc_categories
)
from datumaro.util import dir_items
from datumaro.util.image import lazy_image
from datumaro.util.mask_tools import lazy_mask, invert_colormap


_inverse_inst_colormap = invert_colormap(VocInstColormap)

class VocExtractor(Extractor):
    class Subset(Extractor):
        def __init__(self, name, parent):
            super().__init__()
            self._parent = parent
            self._name = name
            self.items = []

        def __iter__(self):
            for item_id in self.items:
                yield self._parent._get(item_id, self._name)

        def __len__(self):
            return len(self.items)

        def categories(self):
            return self._parent.categories()

    def _load_subsets(self, subsets_dir):
        dir_files = dir_items(subsets_dir, '.txt', truncate_ext=True)
        subset_names = [s for s in dir_files if '_' not in s]

        subsets = {}
        for subset_name in subset_names:
            subset = __class__.Subset(subset_name, self)

            with open(osp.join(subsets_dir, subset_name + '.txt'), 'r') as f:
                subset.items = [line.split()[0] for line in f]

            subsets[subset_name] = subset
        return subsets

    def _load_cls_annotations(self, subsets_dir, subset_names):
        dir_files = dir_items(subsets_dir, '.txt', truncate_ext=True)

        label_annotations = defaultdict(list)
        label_anno_files = [s for s in dir_files \
            if '_' in s and s[s.rfind('_') + 1:] in subset_names]
        for ann_filename in label_anno_files:
            with open(osp.join(subsets_dir, ann_filename + '.txt'), 'r') as f:
                label = ann_filename[:ann_filename.rfind('_')]
                label_id = self._get_label_id(label)
                for line in f:
                    item, present = line.split()
                    if present == '1':
                        label_annotations[item].append(label_id)

        self._annotations[VocTask.classification] = dict(label_annotations)

    def _load_det_annotations(self):
        det_anno_dir = osp.join(self._path, VocPath.ANNOTATIONS_DIR)
        det_anno_items = dir_items(det_anno_dir, '.xml', truncate_ext=True)
        det_annotations = dict()
        for ann_item in det_anno_items:
            with open(osp.join(det_anno_dir, ann_item + '.xml'), 'r') as f:
                ann_file_data = f.read()
                ann_file_root = ET.fromstring(ann_file_data)
                item = ann_file_root.find('filename').text
                item = osp.splitext(item)[0]
                det_annotations[item] = ann_file_data

        self._annotations[VocTask.detection] = det_annotations

    def _load_categories(self):
        label_map = None
        label_map_path = osp.join(self._path, VocPath.LABELMAP_FILE)
        if osp.isfile(label_map_path):
            label_map = parse_label_map(label_map_path)
        self._categories = make_voc_categories(label_map)

    def __init__(self, path, task):
        super().__init__()

        self._path = path
        self._subsets = {}
        self._categories = {}
        self._annotations = {}
        self._task = task

        self._load_categories()

    def __len__(self):
        length = 0
        for subset in self._subsets.values():
            length += len(subset)
        return length

    def subsets(self):
        return list(self._subsets)

    def get_subset(self, name):
        return self._subsets[name]

    def categories(self):
        return self._categories

    def __iter__(self):
        for subset in self._subsets.values():
            for item in subset:
                yield item

    def _get(self, item_id, subset_name):
        image = None
        image_path = osp.join(self._path, VocPath.IMAGES_DIR,
            item_id + VocPath.IMAGE_EXT)
        if osp.isfile(image_path):
            image = lazy_image(image_path)

        annotations = self._get_annotations(item_id)

        return DatasetItem(annotations=annotations,
            id=item_id, subset=subset_name, image=image)

    def _get_label_id(self, label):
        label_id, _ = self._categories[AnnotationType.label].find(label)
        assert label_id is not None
        return label_id

    def _get_annotations(self, item):
        item_annotations = []

        if self._task is VocTask.segmentation:
            segm_path = osp.join(self._path, VocPath.SEGMENTATION_DIR,
                item + VocPath.SEGM_EXT)
            if osp.isfile(segm_path):
                inverse_cls_colormap = \
                    self._categories[AnnotationType.mask].inverse_colormap
                item_annotations.append(MaskObject(
                    image=lazy_mask(segm_path, inverse_cls_colormap),
                    attributes={ 'class': True }
                ))

            inst_path = osp.join(self._path, VocPath.INSTANCES_DIR,
                item + VocPath.SEGM_EXT)
            if osp.isfile(inst_path):
                item_annotations.append(MaskObject(
                    image=lazy_mask(inst_path, _inverse_inst_colormap),
                    attributes={ 'instances': True }
                ))

        cls_annotations = self._annotations.get(VocTask.classification)
        if cls_annotations is not None and \
                self._task is VocTask.classification:
            item_labels = cls_annotations.get(item)
            if item_labels is not None:
                for label_id in item_labels:
                    item_annotations.append(LabelObject(label_id))

        det_annotations = self._annotations.get(VocTask.detection)
        if det_annotations is not None:
            det_annotations = det_annotations.get(item)
        if det_annotations is not None:
            root_elem = ET.fromstring(det_annotations)

            for obj_id, object_elem in enumerate(root_elem.findall('object')):
                attributes = {}
                group = None

                obj_label_id = None
                label_elem = object_elem.find('name')
                if label_elem is not None:
                    obj_label_id = self._get_label_id(label_elem.text)

                obj_bbox = self._parse_bbox(object_elem)

                if obj_label_id is None or obj_bbox is None:
                    continue

                difficult_elem = object_elem.find('difficult')
                attributes['difficult'] = difficult_elem is not None and \
                    difficult_elem.text == '1'

                truncated_elem = object_elem.find('truncated')
                attributes['truncated'] = truncated_elem is not None and \
                    truncated_elem.text == '1'

                occluded_elem = object_elem.find('occluded')
                attributes['occluded'] = occluded_elem is not None and \
                    occluded_elem.text == '1'

                pose_elem = object_elem.find('pose')
                if pose_elem is not None:
                    attributes['pose'] = pose_elem.text

                point_elem = object_elem.find('point')
                if point_elem is not None:
                    point_x = point_elem.find('x')
                    point_y = point_elem.find('y')
                    point = [float(point_x.text), float(point_y.text)]
                    attributes['point'] = point

                actions_elem = object_elem.find('actions')
                actions = {a: False
                    for a in self._categories[AnnotationType.label] \
                        .items[obj_label_id].attributes}
                if actions_elem is not None:
                    for action_elem in actions_elem:
                        actions[action_elem.tag] = (action_elem.text == '1')
                for action, present in actions.items():
                    attributes[action] = present

                for part_elem in object_elem.findall('part'):
                    part = part_elem.find('name').text
                    part_label_id = self._get_label_id(part)
                    bbox = self._parse_bbox(part_elem)
                    group = obj_id

                    if self._task is not VocTask.person_layout:
                        break
                    if bbox is None:
                        continue
                    item_annotations.append(BboxObject(
                        *bbox, label=part_label_id,
                        group=obj_id))

                if self._task is VocTask.person_layout and group is None:
                    continue
                if self._task is VocTask.action_classification and not actions:
                    continue

                item_annotations.append(BboxObject(
                    *obj_bbox, label=obj_label_id,
                    attributes=attributes, id=obj_id, group=group))

        return item_annotations

    @staticmethod
    def _parse_bbox(object_elem):
        bbox_elem = object_elem.find('bndbox')
        if bbox_elem is None:
            return None

        xmin = float(bbox_elem.find('xmin').text)
        xmax = float(bbox_elem.find('xmax').text)
        ymin = float(bbox_elem.find('ymin').text)
        ymax = float(bbox_elem.find('ymax').text)
        return [xmin, ymin, xmax - xmin, ymax - ymin]

class VocClassificationExtractor(VocExtractor):
    def __init__(self, path):
        super().__init__(path, task=VocTask.classification)

        subsets_dir = osp.join(path, VocPath.SUBSETS_DIR, 'Main')
        subsets = self._load_subsets(subsets_dir)
        self._subsets = subsets

        self._load_cls_annotations(subsets_dir, subsets)

class VocDetectionExtractor(VocExtractor):
    def __init__(self, path):
        super().__init__(path, task=VocTask.detection)

        subsets_dir = osp.join(path, VocPath.SUBSETS_DIR, 'Main')
        subsets = self._load_subsets(subsets_dir)
        self._subsets = subsets

        self._load_det_annotations()

class VocSegmentationExtractor(VocExtractor):
    def __init__(self, path):
        super().__init__(path, task=VocTask.segmentation)

        subsets_dir = osp.join(path, VocPath.SUBSETS_DIR, 'Segmentation')
        subsets = self._load_subsets(subsets_dir)
        self._subsets = subsets

class VocLayoutExtractor(VocExtractor):
    def __init__(self, path):
        super().__init__(path, task=VocTask.person_layout)

        subsets_dir = osp.join(path, VocPath.SUBSETS_DIR, 'Layout')
        subsets = self._load_subsets(subsets_dir)
        self._subsets = subsets

        self._load_det_annotations()

class VocActionExtractor(VocExtractor):
    def __init__(self, path):
        super().__init__(path, task=VocTask.action_classification)

        subsets_dir = osp.join(path, VocPath.SUBSETS_DIR, 'Action')
        subsets = self._load_subsets(subsets_dir)
        self._subsets = subsets

        self._load_det_annotations()


class VocResultsExtractor(Extractor):
    class Subset(Extractor):
        def __init__(self, name, parent):
            super().__init__()
            self._parent = parent
            self._name = name
            self.items = []

        def __iter__(self):
            for item in self.items:
                yield self._parent._get(item, self._name)

        def __len__(self):
            return len(self.items)

        def categories(self):
            return self._parent.categories()

    _SUPPORTED_TASKS = {
        VocTask.classification: {
            'dir': 'Main',
            'mark': 'cls',
            'ext': '.txt',
            'path' : ['%(comp)s_cls_%(subset)s_%(label)s.txt'],
            'comp': ['comp1', 'comp2'],
        },
        VocTask.detection: {
            'dir': 'Main',
            'mark': 'det',
            'ext': '.txt',
            'path': ['%(comp)s_det_%(subset)s_%(label)s.txt'],
            'comp': ['comp3', 'comp4'],
        },
        VocTask.segmentation: {
            'dir': 'Segmentation',
            'mark': ['cls', 'inst'],
            'ext': '.png',
            'path': ['%(comp)s_%(subset)s_cls', '%(item)s.png'],
            'comp': ['comp5', 'comp6'],
        },
        VocTask.person_layout: {
            'dir': 'Layout',
            'mark': 'layout',
            'ext': '.xml',
            'path': ['%(comp)s_layout_%(subset)s.xml'],
            'comp': ['comp7', 'comp8'],
        },
        VocTask.action_classification: {
            'dir': 'Action',
            'mark': 'action',
            'ext': '.txt',
            'path': ['%(comp)s_action_%(subset)s_%(label)s.txt'],
            'comp': ['comp9', 'comp10'],
        },
    }

    def _parse_txt_ann(self, path, subsets, annotations, task):
        task_desc = self._SUPPORTED_TASKS[task]
        task_dir = osp.join(path, task_desc['dir'])
        ann_ext = task_desc['ext']
        if not osp.isdir(task_dir):
            return

        ann_files = dir_items(task_dir, ann_ext, truncate_ext=True)

        for ann_file in ann_files:
            ann_parts = filter(None, ann_file.strip().split('_'))
            if len(ann_parts) != 4:
                continue
            _, mark, subset_name, label = ann_parts
            if mark != task_desc['mark']:
                continue

            label_id = self._get_label_id(label)
            anns = defaultdict(list)
            with open(osp.join(task_dir, ann_file + ann_ext), 'r') as f:
                for line in f:
                    line_parts = line.split()
                    item = line_parts[0]
                    anns[item].append((label_id, *line_parts[1:]))

            subset = VocResultsExtractor.Subset(subset_name, self)
            subset.items = list(anns)

            subsets[subset_name] = subset
            annotations[subset_name] = dict(anns)

    def _parse_classification(self, path, subsets, annotations):
        self._parse_txt_ann(path, subsets, annotations,
            VocTask.classification)

    def _parse_detection(self, path, subsets, annotations):
        self._parse_txt_ann(path, subsets, annotations,
            VocTask.detection)

    def _parse_action(self, path, subsets, annotations):
        self._parse_txt_ann(path, subsets, annotations,
            VocTask.action_classification)

    def _load_categories(self):
        label_map = None
        label_map_path = osp.join(self._path, VocPath.LABELMAP_FILE)
        if osp.isfile(label_map_path):
            label_map = parse_label_map(label_map_path)
        self._categories = make_voc_categories(label_map)

    def _get_label_id(self, label):
        label_id = self._categories[AnnotationType.label].find(label)
        assert label_id is not None
        return label_id

    def __init__(self, path):
        super().__init__()

        self._path = path
        self._subsets = {}
        self._annotations = {}

        self._load_categories()

    def __len__(self):
        length = 0
        for subset in self._subsets.values():
            length += len(subset)
        return length

    def subsets(self):
        return list(self._subsets)

    def get_subset(self, name):
        return self._subsets[name]

    def categories(self):
        return self._categories

    def __iter__(self):
        for subset in self._subsets.values():
            for item in subset:
                yield item

    def _get(self, item, subset_name):
        image = None
        image_path = osp.join(self._path, VocPath.IMAGES_DIR,
            item + VocPath.IMAGE_EXT)
        if osp.isfile(image_path):
            image = lazy_image(image_path)

        annotations = self._get_annotations(item, subset_name)

        return DatasetItem(annotations=annotations,
            id=item, subset=subset_name, image=image)

    def _get_annotations(self, item, subset_name):
        raise NotImplementedError()

class VocComp_1_2_Extractor(VocResultsExtractor):
    def __init__(self, path):
        super().__init__(path)

        subsets = {}
        annotations = defaultdict(dict)

        self._parse_classification(path, subsets, annotations)

        self._subsets = subsets
        self._annotations = dict(annotations)

    def _get_annotations(self, item, subset_name):
        annotations = []

        cls_ann = self._annotations[subset_name].get(item)
        if cls_ann is not None:
            for desc in cls_ann:
                label_id, conf = desc
                annotations.append(LabelObject(
                    int(label_id),
                    attributes={ 'score': float(conf) }
                ))

        return annotations

class VocComp_3_4_Extractor(VocResultsExtractor):
    def __init__(self, path):
        super().__init__(path)

        subsets = {}
        annotations = defaultdict(dict)

        self._parse_detection(path, subsets, annotations)

        self._subsets = subsets
        self._annotations = dict(annotations)

    def _get_annotations(self, item, subset_name):
        annotations = []

        det_ann = self._annotations[subset_name].get(item)
        if det_ann is not None:
            for desc in det_ann:
                label_id, conf, left, top, right, bottom = desc
                annotations.append(BboxObject(
                    x=float(left), y=float(top),
                    w=float(right) - float(left), h=float(bottom) - float(top),
                    label=int(label_id),
                    attributes={ 'score': float(conf) }
                ))

        return annotations

class VocComp_5_6_Extractor(VocResultsExtractor):
    def __init__(self, path):
        super().__init__(path)

        subsets = {}
        annotations = defaultdict(dict)

        task_dir = osp.join(path, 'Segmentation')
        if not osp.isdir(task_dir):
            return

        ann_files = os.listdir(task_dir)

        for ann_dir in ann_files:
            ann_parts = filter(None, ann_dir.strip().split('_'))
            if len(ann_parts) != 4:
                continue
            _, subset_name, mark = ann_parts
            if mark not in ['cls', 'inst']:
                continue

            item_dir = osp.join(task_dir, ann_dir)
            items = dir_items(item_dir, '.png', truncate_ext=True)
            items = { name: osp.join(item_dir, item + '.png') \
                for name, item in items }

            subset = VocResultsExtractor.Subset(subset_name, self)
            subset.items = list(items)

            subsets[subset_name] = subset
            annotations[subset_name][mark] = items

        self._subsets = subsets
        self._annotations = dict(annotations)

    def _get_annotations(self, item, subset_name):
        annotations = []

        segm_ann = self._annotations[subset_name]
        cls_image_path = segm_ann.get(item)
        if cls_image_path and osp.isfile(cls_image_path):
            inverse_cls_colormap = \
                self._categories[AnnotationType.mask].inverse_colormap
            annotations.append(MaskObject(
                image=lazy_mask(cls_image_path, inverse_cls_colormap),
                attributes={ 'class': True }
            ))

        inst_ann = self._annotations[subset_name]
        inst_image_path = inst_ann.get(item)
        if inst_image_path and osp.isfile(inst_image_path):
            annotations.append(MaskObject(
                image=lazy_mask(inst_image_path, _inverse_inst_colormap),
                attributes={ 'instances': True }
            ))

        return annotations

class VocComp_7_8_Extractor(VocResultsExtractor):
    def __init__(self, path):
        super().__init__(path)

        subsets = {}
        annotations = defaultdict(dict)

        task = VocTask.person_layout
        task_desc = self._SUPPORTED_TASKS[task]
        task_dir = osp.join(path, task_desc['dir'])
        if not osp.isdir(task_dir):
            return

        ann_ext = task_desc['ext']
        ann_files = dir_items(task_dir, ann_ext, truncate_ext=True)

        for ann_file in ann_files:
            ann_parts = filter(None, ann_file.strip().split('_'))
            if len(ann_parts) != 4:
                continue
            _, mark, subset_name, _ = ann_parts
            if mark != task_desc['mark']:
                continue

            layouts = {}
            root = ET.parse(osp.join(task_dir, ann_file + ann_ext))
            root_elem = root.getroot()
            for layout_elem in root_elem.findall('layout'):
                item = layout_elem.find('image').text
                obj_id = int(layout_elem.find('object').text)
                conf = float(layout_elem.find('confidence').text)
                parts = []
                for part_elem in layout_elem.findall('part'):
                    label_id = self._get_label_id(part_elem.find('class').text)
                    bbox_elem = part_elem.find('bndbox')
                    xmin = float(bbox_elem.find('xmin').text)
                    xmax = float(bbox_elem.find('xmax').text)
                    ymin = float(bbox_elem.find('ymin').text)
                    ymax = float(bbox_elem.find('ymax').text)
                    bbox = [xmin, ymin, xmax - xmin, ymax - ymin]
                    parts.append((label_id, bbox))
                layouts[item] = [obj_id, conf, parts]

            subset = VocResultsExtractor.Subset(subset_name, self)
            subset.items = list(layouts)

            subsets[subset_name] = subset
            annotations[subset_name] = layouts

        self._subsets = subsets
        self._annotations = dict(annotations)

    def _get_annotations(self, item, subset_name):
        annotations = []

        layout_ann = self._annotations[subset_name].get(item)
        if layout_ann is not None:
            for desc in layout_ann:
                obj_id, conf, parts = desc
                attributes = {
                    'score': conf,
                    'object_id': obj_id,
                }

                for part in parts:
                    label_id, bbox = part
                    annotations.append(BboxObject(
                        *bbox, label=label_id,
                        attributes=attributes))

        return annotations

class VocComp_9_10_Extractor(VocResultsExtractor):
    def __init__(self, path):
        super().__init__(path)

        subsets = {}
        annotations = defaultdict(dict)

        self._parse_action(path, subsets, annotations)

        self._subsets = subsets
        self._annotations = dict(annotations)

    def _load_categories(self):
        from collections import OrderedDict
        from datumaro.components.formats.voc import VocAction
        label_map = OrderedDict((a.name, [[], [], []]) for a in VocAction)
        self._categories = make_voc_categories(label_map)

    def _get_annotations(self, item, subset_name):
        annotations = []

        action_ann = self._annotations[subset_name].get(item)
        if action_ann is not None:
            for desc in action_ann:
                action_id, obj_id, conf = desc
                annotations.append(LabelObject(
                    action_id,
                    attributes={
                        'score': conf,
                        'object_id': int(obj_id),
                    }
                ))

        return annotations