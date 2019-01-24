from rest_framework import serializers
from cvat.apps.engine.models import Task, Job, Label, AttributeSpec
from django.contrib.auth.models import User, Group

class AttributeSerializer(serializers.PrimaryKeyRelatedField, serializers.ModelSerializer):
    class Meta:
        model = AttributeSpec
        fields = ('id', 'text')

class LabelSerializer(serializers.PrimaryKeyRelatedField, serializers.ModelSerializer):
    attributes = AttributeSerializer(many=True, source='attributespec_set')
    class Meta:
        model = Label
        fields = ('id', 'name', 'attributes')

    def create(self, validated_data):
        attributes = validated_data.pop('attributes')
        label = Label.objects.create(**validated_data)
        for attr in attributes:
            AttributeSpec.objects.create(label=label, **attr)

        return label


class TaskSerializer(serializers.ModelSerializer):
    labels = LabelSerializer(many=True, source='label_set')
    class Meta:
        model = Task
        fields = ('id', 'name', 'size', 'mode', 'owner', 'assignee',
            'bug_tracker', 'created_date', 'updated_date', 'overlap',
            'z_order', 'flipped', 'status', 'labels')
        read_only_fields = ('size', 'mode', 'created_date', 'updated_date',
            'overlap', 'status')

    def create(self, validated_data):
        labels = validated_data.pop('labels')
        task = Task.objects.create(**validated_data)
        for label in labels:
            Label.objects.create(task=task, **label)

        return task


class JobSerializer(serializers.HyperlinkedModelSerializer):
    task_id = serializers.ReadOnlyField(source="segment.task.id")
    start_frame = serializers.ReadOnlyField(source="segment.start_frame")
    stop_frame = serializers.ReadOnlyField(source="segment.stop_frame")

    class Meta:
        model = Job
        fields = ('url', 'id', 'assignee', 'status', 'start_frame',
            'stop_frame', 'max_shape_id', 'task_id')
        read_only_fields = ('max_shape_id',)

class UserSerializer(serializers.HyperlinkedModelSerializer):
    groups = serializers.SlugRelatedField(many=True,
        slug_field='name', queryset=Group.objects.all())

    class Meta:
        model = User
        fields = ('url', 'id', 'username', 'first_name', 'last_name', 'email',
            'groups', 'is_staff', 'is_superuser', 'is_active', 'last_login',
            'date_joined', 'groups')
        read_only_fields = ('last_login', 'date_joined')
        write_only_fields = ('password', )

class ExceptionSerializer(serializers.Serializer):
    task = serializers.IntegerField()
    job = serializers.IntegerField()
    message = serializers.CharField(max_length=1000)
    filename = serializers.URLField()
    line = serializers.IntegerField()
    column = serializers.IntegerField()
    stack = serializers.CharField(max_length=10000,
        style={'base_template': 'textarea.html'})
    browser = serializers.CharField(max_length=255)
    os = serializers.CharField(max_length=255)

class AboutSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=128)
    description = serializers.CharField(max_length=2048)
    version = serializers.CharField(max_length=64)
