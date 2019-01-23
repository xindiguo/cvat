from rest_framework import serializers
from cvat.apps.engine.models import Task, Job
from django.contrib.auth.models import User, Group

class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = ('id', 'name', 'size', 'mode', 'owner', 'assignee',
            'bug_tracker', 'created_date', 'updated_date', 'overlap',
            'z_order', 'flipped', 'source', 'status')
        read_only_fields = ('size', 'mode', 'created_date', 'updated_date',
            'overlap', 'source', 'status')

class JobSerializer(serializers.ModelSerializer):
    class Meta:
        model = Job
        fields = ('id', 'assignee', 'status')

class UserSerializer(serializers.ModelSerializer):
    groups = serializers.SlugRelatedField(many=True,
        slug_field='name', queryset=Group.objects.all())

    class Meta:
        model = User
        fields = ('id', 'username', 'first_name', 'last_name', 'email',
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
