# Copyright (C) 2018 Intel Corporation
#
# SPDX-License-Identifier: MIT

format_spec = {
    "name": "YOLO",
    "dumpers": [
        {
            "display_name": "{name} {format} {version}",
            "format": "ZIP",
            "version": "1.0",
            "handler": "dump"
        },
    ],
    "loaders": [
        {
            "display_name": "{name} {format} {version}",
            "format": "ZIP",
            "version": "1.0",
            "handler": "load"
        },
    ],
}

def load(file_object, annotations):
    from pyunpack import Archive
    import os
    from tempfile import TemporaryDirectory
    from glob import glob

    def convert_from_yolo(img_size, box):
        # convertation formulas are based on https://github.com/pjreddie/darknet/blob/master/scripts/voc_label.py
        # <x> <y> <width> <height> - float values relative to width and height of image
        # <x> <y> - are center of rectangle
        def clamp(value, _min, _max):
            return max(min(_max, value), _min)
        xtl = clamp(img_size[0] * (box[0] - box[2] / 2), 0, img_size[0])
        ytl = clamp(img_size[1] * (box[1] - box[3] / 2), 0, img_size[1])
        xbr = clamp(img_size[0] * (box[0] + box[2] / 2), 0, img_size[0])
        ybr = clamp(img_size[1] * (box[1] + box[3] / 2), 0, img_size[1])

        return [xtl, ytl, xbr, ybr]

    def parse_yolo_obj(img_size, obj):
        label_id, x, y, w, h = obj.split(" ")
        return int(label_id), convert_from_yolo(img_size, (float(x), float(y), float(w), float(h)))

    def parse_yolo_file(annotation_file, labels_mapping):
        frame_number = annotations.match_frame(annotation_file)
        with open(annotation_file, "r") as fp:
            line = fp.readline()
            while line:
                frame_info = annotations.frame_info[frame_number]
                label_id, points = parse_yolo_obj((frame_info["width"], frame_info["height"]), line)
                annotations.add_shape(annotations.LabeledShape(
                    type="rectangle",
                    frame=frame_number,
                    label=labels_mapping[label_id],
                    points=points,
                    occluded=False,
                    attributes=[],
                ))
                line = fp.readline()

    def load_labels(labels_file):
        with open(labels_file, "r") as f:
            return {idx: label.strip() for idx, label in enumerate(f.readlines()) if label.strip()}

    archive_file = file_object if isinstance(file_object, str) else getattr(file_object, "name")
    with TemporaryDirectory() as tmp_dir:
        Archive(archive_file).extractall(tmp_dir)

        labels_file = glob(os.path.join(tmp_dir, "*.names"))
        if not labels_file:
            raise Exception("Could not find '*.names' file with labels in uploaded archive")
        elif len(labels_file) == 1:
            labels_mapping = load_labels(labels_file[0])
        else:
            raise Exception("Too many '*.names' files in uploaded archive: {}".format(labels_file))

        for dirpath, _, filenames in os.walk(tmp_dir):
            for file in filenames:
                if ".txt" == os.path.splitext(file)[1]:
                    parse_yolo_file(os.path.join(dirpath, file), labels_mapping)

def dump(file_object, annotations):
    from zipfile import ZipFile
    import os

    # convertation formulas are based on https://github.com/pjreddie/darknet/blob/master/scripts/voc_label.py
    # <x> <y> <width> <height> - float values relative to width and height of image
    # <x> <y> - are center of rectangle
    def convert_to_yolo(img_size, box):
        x = (box[0] + box[2]) / 2 / img_size[0]
        y = (box[1] + box[3]) / 2 / img_size[1]
        w = (box[2] - box[0]) / img_size[0]
        h = (box[3] - box[1]) / img_size[1]

        return x, y, w, h

    labels_ids = {label[1]["name"]: idx for idx, label in enumerate(annotations.meta["task"]["labels"])}

    with ZipFile(file_object, "w") as output_zip:
        for frame_annotation in annotations.group_by_frame():
            image_name = frame_annotation.name
            annotation_name = "{}.txt".format(os.path.splitext(os.path.basename(image_name))[0])
            width = frame_annotation.width
            height = frame_annotation.height

            yolo_annotation = ""
            for shape in frame_annotation.labeled_shapes:
                if shape.type != "rectangle":
                    continue

                label = shape.label
                yolo_bb = convert_to_yolo((width, height), shape.points)
                yolo_bb = " ".join("{:.6f}".format(p) for p in yolo_bb)
                yolo_annotation += "{} {}\n".format(labels_ids[label], yolo_bb)

            output_zip.writestr(annotation_name, yolo_annotation)
        output_zip.writestr("obj.names", "\n".join(l[0] for l in sorted(labels_ids.items(), key=lambda x:x[1])))
