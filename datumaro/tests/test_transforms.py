import numpy as np

from unittest import TestCase

from datumaro.components.extractor import (Extractor, DatasetItem,
    Mask, Polygon
)
from datumaro.util.test_utils import compare_datasets
import datumaro.plugins.transforms as transforms


class TransformsTest(TestCase):
    def test_reindex(self):
        class SrcExtractor(Extractor):
            def __iter__(self):
                return iter([
                    DatasetItem(id=10),
                    DatasetItem(id=10, subset='train'),
                    DatasetItem(id='a', subset='val'),
                ])

        class DstExtractor(Extractor):
            def __iter__(self):
                return iter([
                    DatasetItem(id=5),
                    DatasetItem(id=6, subset='train'),
                    DatasetItem(id=7, subset='val'),
                ])

        actual = transforms.Reindex(SrcExtractor(), start=5)
        compare_datasets(self, DstExtractor(), actual)

    def test_mask_to_polygons(self):
        class SrcExtractor(Extractor):
            def __iter__(self):
                items = [
                    DatasetItem(id=1, image=np.zeros((5, 10, 3)),
                        annotations=[
                            Mask(np.array([
                                    [0, 1, 1, 1, 0, 1, 1, 1, 1, 0],
                                    [0, 0, 1, 1, 0, 1, 1, 1, 0, 0],
                                    [0, 0, 0, 1, 0, 1, 1, 0, 0, 0],
                                    [0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
                                    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                                ]),
                            ),
                        ]
                    ),
                ]
                return iter(items)

        class DstExtractor(Extractor):
            def __iter__(self):
                return iter([
                    DatasetItem(id=1, image=np.zeros((5, 10, 3)),
                        annotations=[
                            Polygon([3.0, 2.5, 1.0, 0.0, 3.5, 0.0, 3.0, 2.5]),
                            Polygon([5.0, 3.5, 4.5, 0.0, 8.0, 0.0, 5.0, 3.5]),
                        ]
                    ),
                ])

        actual = transforms.MasksToPolygons(SrcExtractor())
        compare_datasets(self, DstExtractor(), actual)

    def test_polygons_to_masks(self):
        class SrcExtractor(Extractor):
            def __iter__(self):
                return iter([
                    DatasetItem(id=1, image=np.zeros((5, 10, 3)),
                        annotations=[
                            Polygon([0, 0, 4, 0, 4, 4]),
                            Polygon([5, 0, 9, 0, 5, 5]),
                        ]
                    ),
                ])

        class DstExtractor(Extractor):
            def __iter__(self):
                return iter([
                    DatasetItem(id=1, image=np.zeros((5, 10, 3)),
                        annotations=[
                            Mask(np.array([
                                    [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
                                    [0, 0, 0, 0, 0, 1, 1, 1, 0, 0],
                                    [0, 0, 0, 0, 0, 1, 1, 0, 0, 0],
                                    [0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
                                    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                                ]),
                            ),
                            Mask(np.array([
                                    [0, 1, 1, 1, 0, 0, 0, 0, 0, 0],
                                    [0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
                                    [0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
                                    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                                    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                                ]),
                            ),
                        ]
                    ),
                ])

        actual = transforms.PolygonsToMasks(SrcExtractor())
        compare_datasets(self, DstExtractor(), actual)

    def test_crop_covered_segments(self):
        class SrcExtractor(Extractor):
            def __iter__(self):
                return iter([
                    DatasetItem(id=1, image=np.zeros((5, 5, 3)),
                        annotations=[
                            # The mask is partially covered by the polygon
                            Mask(np.array([
                                    [0, 0, 1, 1, 1],
                                    [0, 0, 1, 1, 1],
                                    [1, 1, 1, 1, 1],
                                    [1, 1, 1, 0, 0],
                                    [1, 1, 1, 0, 0]],
                                ),
                                z_order=0),
                            Polygon([1, 1, 4, 1, 4, 4, 1, 4],
                                z_order=1),
                        ]
                    ),
                ])

        class DstExtractor(Extractor):
            def __iter__(self):
                return iter([
                    DatasetItem(id=1, image=np.zeros((5, 5, 3)),
                        annotations=[
                            Mask(np.array([
                                    [0, 0, 1, 1, 1],
                                    [0, 0, 0, 0, 1],
                                    [1, 0, 0, 0, 1],
                                    [1, 0, 0, 0, 0],
                                    [1, 1, 1, 0, 0]],
                                ),
                                z_order=0),
                            Polygon([1, 1, 4, 1, 4, 4, 1, 4],
                                z_order=1),
                        ]
                    ),
                ])

        actual = transforms.CropCoveredSegments(SrcExtractor())
        compare_datasets(self, DstExtractor(), actual)

    def test_merge_instance_segments(self):
        class SrcExtractor(Extractor):
            def __iter__(self):
                return iter([
                    DatasetItem(id=1, image=np.zeros((5, 5, 3)),
                        annotations=[
                            Mask(np.array([
                                    [0, 0, 1, 1, 1],
                                    [0, 0, 0, 0, 1],
                                    [1, 0, 0, 0, 1],
                                    [1, 0, 0, 0, 0],
                                    [1, 1, 1, 0, 0]],
                                ),
                                z_order=0),
                            Polygon([1, 1, 4, 1, 4, 4, 1, 4],
                                z_order=1),
                        ]
                    ),
                ])

        class DstExtractor(Extractor):
            def __iter__(self):
                return iter([
                    DatasetItem(id=1, image=np.zeros((5, 5, 3)),
                        annotations=[
                            Mask(np.array([
                                    [0, 0, 1, 1, 1],
                                    [0, 1, 1, 1, 1],
                                    [1, 1, 1, 1, 1],
                                    [1, 1, 1, 1, 0],
                                    [1, 1, 1, 0, 0]],
                                ),
                                z_order=0),
                        ]
                    ),
                ])

        actual = transforms.MergeInstanceSegments(SrcExtractor(),
            include_polygons=True)
        compare_datasets(self, DstExtractor(), actual)