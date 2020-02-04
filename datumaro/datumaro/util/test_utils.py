
# Copyright (C) 2019 Intel Corporation
#
# SPDX-License-Identifier: MIT

import inspect
import os
import os.path as osp
import shutil
import tempfile


def current_function_name(depth=1):
    return inspect.getouterframes(inspect.currentframe())[depth].function

class FileRemover:
    def __init__(self, path, is_dir=False, ignore_errors=False):
        self.path = path
        self.is_dir = is_dir
        self.ignore_errors = ignore_errors

    def __enter__(self):
        return self

    # pylint: disable=redefined-builtin
    def __exit__(self, type=None, value=None, traceback=None):
        if self.is_dir:
            shutil.rmtree(self.path, ignore_errors=self.ignore_errors)
        else:
            os.remove(self.path)
    # pylint: enable=redefined-builtin

class TestDir(FileRemover):
    def __init__(self, path=None, ignore_errors=False):
        if path is None:
            path = osp.abspath('temp_%s-' % current_function_name(2))
            path = tempfile.mkdtemp(dir=os.getcwd(), prefix=path)
        else:
            os.makedirs(path, exist_ok=ignore_errors)

        super().__init__(path, is_dir=True, ignore_errors=ignore_errors)

def ann_to_str(ann):
    return vars(ann)

def item_to_str(item):
    return '\n'.join(
        [
            '%s' % vars(item)
        ] + [
            'ann[%s]: %s' % (i, ann_to_str(a))
            for i, a in enumerate(item.annotations)
        ]
    )