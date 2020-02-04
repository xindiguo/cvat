import numpy as np
import os
import os.path as osp
from xml.etree import ElementTree as ET

from unittest import TestCase

from datumaro.components.extractor import (Extractor, DatasetItem,
    AnnotationType, PointsObject, PolygonObject, PolyLineObject, BboxObject,
    LabelCategories,
)
from datumaro.components.importers.cvat import CvatImporter
from datumaro.components.converters.cvat import CvatConverter
from datumaro.components.project import Project
import datumaro.components.formats.cvat as Cvat
from datumaro.util.image import save_image
from datumaro.util.test_utils import TestDir, item_to_str


class CvatExtractorTest(TestCase):
    @staticmethod
    def generate_dummy_cvat(path):
        images_dir = osp.join(path, Cvat.CvatPath.IMAGES_DIR)
        anno_dir = osp.join(path, Cvat.CvatPath.ANNOTATIONS_DIR)

        os.makedirs(images_dir)
        os.makedirs(anno_dir)

        root_elem = ET.Element('annotations')
        ET.SubElement(root_elem, 'version').text = '1.1'

        meta_elem = ET.SubElement(root_elem, 'meta')
        task_elem = ET.SubElement(meta_elem, 'task')
        ET.SubElement(task_elem, 'z_order').text = 'True'
        ET.SubElement(task_elem, 'mode').text = 'interpolation'

        labels_elem = ET.SubElement(task_elem, 'labels')

        label1_elem = ET.SubElement(labels_elem, 'label')
        ET.SubElement(label1_elem, 'name').text = 'label1'
        label1_attrs_elem = ET.SubElement(label1_elem, 'attributes')

        label1_a1_elem = ET.SubElement(label1_attrs_elem, 'attribute')
        ET.SubElement(label1_a1_elem, 'name').text = 'a1'
        ET.SubElement(label1_a1_elem, 'input_type').text = 'checkbox'
        ET.SubElement(label1_a1_elem, 'default_value').text = 'false'
        ET.SubElement(label1_a1_elem, 'values').text = 'false\ntrue'

        label1_a2_elem = ET.SubElement(label1_attrs_elem, 'attribute')
        ET.SubElement(label1_a2_elem, 'name').text = 'a2'
        ET.SubElement(label1_a2_elem, 'input_type').text = 'radio'
        ET.SubElement(label1_a2_elem, 'default_value').text = 'v1'
        ET.SubElement(label1_a2_elem, 'values').text = 'v1\nv2\nv3'

        label2_elem = ET.SubElement(labels_elem, 'label')
        ET.SubElement(label2_elem, 'name').text = 'label2'

        # item 1
        save_image(osp.join(images_dir, 'img0.jpg'), np.ones((8, 8, 3)))
        item1_elem = ET.SubElement(root_elem, 'image')
        item1_elem.attrib.update({
            'id': '0', 'name': 'img0', 'width': '8', 'height': '8'
        })

        item1_ann1_elem = ET.SubElement(item1_elem, 'box')
        item1_ann1_elem.attrib.update({
            'label': 'label1', 'occluded': '1', 'z_order': '1',
            'xtl': '0', 'ytl': '2', 'xbr': '4', 'ybr': '4'
        })
        item1_ann1_a1_elem = ET.SubElement(item1_ann1_elem, 'attribute')
        item1_ann1_a1_elem.attrib['name'] = 'a1'
        item1_ann1_a1_elem.text = 'true'
        item1_ann1_a2_elem = ET.SubElement(item1_ann1_elem, 'attribute')
        item1_ann1_a2_elem.attrib['name'] = 'a2'
        item1_ann1_a2_elem.text = 'v3'

        item1_ann2_elem = ET.SubElement(item1_elem, 'polyline')
        item1_ann2_elem.attrib.update({
            'label': '', 'points': '1.0,2;3,4;5,6;7,8'
        })

        # item 2
        save_image(osp.join(images_dir, 'img1.jpg'), np.ones((10, 10, 3)))
        item2_elem = ET.SubElement(root_elem, 'image')
        item2_elem.attrib.update({
            'id': '1', 'name': 'img1', 'width': '8', 'height': '8'
        })

        item2_ann1_elem = ET.SubElement(item2_elem, 'polygon')
        item2_ann1_elem.attrib.update({
            'label': '', 'points': '1,2;3,4;6,5', 'z_order': '1',
        })

        item2_ann2_elem = ET.SubElement(item2_elem, 'points')
        item2_ann2_elem.attrib.update({
            'label': 'label2', 'points': '1,2;3,4;5,6', 'z_order': '2',
        })

        with open(osp.join(anno_dir, 'train.xml'), 'w') as f:
            f.write(ET.tostring(root_elem, encoding='unicode'))

    def test_can_load(self):
        class TestExtractor(Extractor):
            def __iter__(self):
                return iter([
                    DatasetItem(id=1, subset='train', image=np.ones((8, 8, 3)),
                        annotations=[
                            BboxObject(0, 2, 4, 2, label=0,
                                attributes={
                                    'occluded': True, 'z_order': 1,
                                    'a1': True, 'a2': 'v3'
                                }),
                            PolyLineObject([1, 2, 3, 4, 5, 6, 7, 8],
                                attributes={'occluded': False, 'z_order': 0}),
                        ]),
                    DatasetItem(id=2, subset='train', image=np.ones((10, 10, 3)),
                        annotations=[
                            PolygonObject([1, 2, 3, 4, 6, 5],
                                attributes={'occluded': False, 'z_order': 1}),
                            PointsObject([1, 2, 3, 4, 5, 6], label=1,
                                attributes={'occluded': False, 'z_order': 2}),
                        ]),
                ])

            def categories(self):
                label_categories = LabelCategories()
                for i in range(10):
                    label_categories.add('label_' + str(i))
                return {
                    AnnotationType.label: label_categories,
                }

        with TestDir() as test_dir:
            self.generate_dummy_cvat(test_dir.path)
            source_dataset = TestExtractor()

            parsed_dataset = CvatImporter()(test_dir.path).make_dataset()

            self.assertListEqual(
                sorted(source_dataset.subsets()),
                sorted(parsed_dataset.subsets()),
            )
            self.assertEqual(len(source_dataset), len(parsed_dataset))
            for subset_name in source_dataset.subsets():
                source_subset = source_dataset.get_subset(subset_name)
                parsed_subset = parsed_dataset.get_subset(subset_name)
                for item_a, item_b in zip(source_subset, parsed_subset):
                    self.assertEqual(len(item_a.annotations), len(item_b.annotations))
                    for ann_a, ann_b in zip(item_a.annotations, item_b.annotations):
                        self.assertEqual(ann_a, ann_b)


class CvatConverterTest(TestCase):
    def _test_save_and_load(self, source_dataset, converter, test_dir,
            importer_params=None, target_dataset=None):
        converter(source_dataset, test_dir.path)

        if not importer_params:
            importer_params = {}
        project = Project.import_from(test_dir.path, 'cvat', **importer_params)
        parsed_dataset = project.make_dataset()

        if target_dataset is not None:
            source_dataset = target_dataset
        self.assertListEqual(
            sorted(source_dataset.subsets()),
            sorted(parsed_dataset.subsets()),
        )

        self.assertEqual(len(source_dataset), len(parsed_dataset))

        for subset_name in source_dataset.subsets():
            source_subset = source_dataset.get_subset(subset_name)
            parsed_subset = parsed_dataset.get_subset(subset_name)
            self.assertEqual(len(source_subset), len(parsed_subset))
            for idx, (item_a, item_b) in enumerate(
                    zip(source_subset, parsed_subset)):
                self.assertEqual(item_a, item_b, '%s:\n%s\nvs.\n%s\n' % \
                    (idx, item_to_str(item_a), item_to_str(item_b)))

    def test_can_save_and_load(self):
        label_categories = LabelCategories()
        for i in range(10):
            label_categories.add(str(i))
        label_categories.items[2].attributes.update(['a1', 'a2'])
        label_categories.attributes.update(['z_order', 'occluded'])

        class SrcTestExtractor(Extractor):
            def __iter__(self):
                return iter([
                    DatasetItem(id=0, subset='s1', image=np.zeros((5, 10, 3)),
                        annotations=[
                            PolygonObject([0, 0, 4, 0, 4, 4],
                                label=1, group=4,
                                attributes={ 'occluded': True }),
                            PolygonObject([5, 0, 9, 0, 5, 5],
                                label=2, group=4,
                                attributes={ 'unknown': 'bar' }),
                            PointsObject([1, 1, 3, 2, 2, 3],
                                label=2,
                                attributes={ 'a1': 'x', 'a2': 42 }),
                        ]
                    ),
                    DatasetItem(id=1, subset='s1',
                        annotations=[
                            PolyLineObject([0, 0, 4, 0, 4, 4],
                                label=3, id=4, group=4),
                            BboxObject(5, 0, 1, 9,
                                label=3, id=4, group=4),
                        ]
                    ),

                    DatasetItem(id=2, subset='s2', image=np.ones((5, 10, 3)),
                        annotations=[
                            PolygonObject([0, 0, 4, 0, 4, 4],
                                label=3, group=4,
                                attributes={ 'z_order': 1, 'occluded': False }),
                            PolyLineObject([5, 0, 9, 0, 5, 5]), # will be skipped as no label
                        ]
                    ),
                ])

            def categories(self):
                return { AnnotationType.label: label_categories }

        class DstTestExtractor(Extractor):
            def __iter__(self):
                return iter([
                    DatasetItem(id=0, subset='s1', image=np.zeros((5, 10, 3)),
                        annotations=[
                            PolygonObject([0, 0, 4, 0, 4, 4],
                                label=1, group=4,
                                attributes={ 'z_order': 0, 'occluded': True }),
                            PolygonObject([5, 0, 9, 0, 5, 5],
                                label=2, group=4,
                                attributes={ 'z_order': 0, 'occluded': False }),
                            PointsObject([1, 1, 3, 2, 2, 3],
                                label=2,
                                attributes={ 'z_order': 0, 'occluded': False,
                                    'a1': 'x', 'a2': 42 }),
                        ]
                    ),
                    DatasetItem(id=1, subset='s1',
                        annotations=[
                            PolyLineObject([0, 0, 4, 0, 4, 4],
                                label=3, group=4,
                                attributes={ 'z_order': 0, 'occluded': False }),
                            BboxObject(5, 0, 1, 9,
                                label=3, group=4,
                                attributes={ 'z_order': 0, 'occluded': False }),
                        ]
                    ),

                    DatasetItem(id=2, subset='s2', image=np.ones((5, 10, 3)),
                        annotations=[
                            PolygonObject([0, 0, 4, 0, 4, 4],
                                label=3, group=4,
                                attributes={ 'z_order': 1, 'occluded': False }),
                        ]
                    ),
                ])

            def categories(self):
                return { AnnotationType.label: label_categories }

        with TestDir() as test_dir:
            self._test_save_and_load(SrcTestExtractor(),
                CvatConverter(save_images=True), test_dir,
                target_dataset=DstTestExtractor())
