from rest_framework import serializers
from cvat.apps.engine.models import Task
from django.contrib.auth.models import User, Group

class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = ('id', 'name', 'size', 'mode', 'owner', 'assignee',
            'bug_tracker', 'created_date', 'updated_date', 'overlap',
            'z_order', 'flipped', 'source', 'status')

class GroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = ('name',)

class UserSerializer(serializers.ModelSerializer):
    groups = GroupSerializer(many=True)

    class Meta:
        model = User
        fields = ('id', 'first_name', 'last_name', 'email', 'is_staff',
            'is_superuser', 'is_active', 'groups')
        write_only_fields = ('password', 'date_joined')
