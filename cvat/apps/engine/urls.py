
# Copyright (C) 2018 Intel Corporation
#
# SPDX-License-Identifier: MIT

from django.urls import path
from . import views

REST_API_PREFIX = 'api/<version>/'

urlpatterns = [
    path( # entry point for API
        REST_API_PREFIX,
        views.api_root,
        name='root'),
    path( # GET, POST
        REST_API_PREFIX + 'tasks/',
        views.TaskList.as_view(),
        name='task-list'),
    path( # GET, DELETE, PATCH
        REST_API_PREFIX + 'tasks/<int:pk>',
        views.TaskDetail.as_view(),
        name='task-detail'),
    path( # GET
        REST_API_PREFIX + 'tasks/<int:pk>/frames/<int:frame>',
        views.dummy_view,
        name='task-frame'),
    path( # GET
        REST_API_PREFIX + 'tasks/<int:pk>/jobs/',
        views.dummy_view,
        name='job-list'),
    path( # GET, PATCH
        REST_API_PREFIX + 'jobs/<int:pk>',
        views.dummy_view,
        name='job-detail'),
    path( # GET, DELETE, PATCH, PUT
        REST_API_PREFIX + 'tasks/<int:pk>/annotations/',
        views.dummy_view,
        name='task-annotations'),
    path( # GET, DELETE, PATCH, PUT
        REST_API_PREFIX + 'jobs/<int:pk>/annotations/',
        views.dummy_view,
        name='job-annotations'),
    path( # GET
        REST_API_PREFIX + 'users/',
        views.UserList.as_view(),
        name='user-list'),
    path( # GET, DELETE, PATCH
        REST_API_PREFIX + 'users/<int:pk>',
        views.UserDetail.as_view(),
        name='user-detail'),
    path( # GET
        REST_API_PREFIX + 'users/myself',
        views.dummy_view,
        name='user-myself'),
    path( # POST
        REST_API_PREFIX + 'exceptions/',
        views.dummy_view,
        name='exception-list'),
    path( # GET
        REST_API_PREFIX + 'info/',
        views.dummy_view,
        name='server-info'),
    path( # GET
        REST_API_PREFIX + 'plugins/',
        views.dummy_view,
        name='plugin-list'),
    path( # GET, PATCH, PUT
        REST_API_PREFIX + 'plugins/<slug:name>/config/',
        views.dummy_view,
        name='plugin-config'),
    path( # GET, POST
        REST_API_PREFIX + 'plugins/<slug:name>/data/',
        views.dummy_view,
        name='plugin-data-list'),
    path( # GET, PATCH, DELETE, PUT
        REST_API_PREFIX + 'plugins/<slug:name>/data/<int:id>',
        views.dummy_view,
        name='plugin-data-detail'),
    path( # GET, POST
        REST_API_PREFIX + 'plugins/<slug:name>/requests/',
        views.dummy_view,
        name='plugin-request-list'),
    path( # GET, DELETE
        REST_API_PREFIX + 'plugins/<slug:name>/requests/<int:id>',
        views.dummy_view,
        name='plugin-request-detail'),

    path('create/task', views.create_task), ####
    path('get/task/<int:tid>/frame/<int:frame>', views.get_frame), ###
    path('check/task/<int:tid>', views.check_task), ####
    path('delete/task/<int:tid>', views.delete_task), ####
    path('update/task/<int:tid>', views.update_task), ####
    path('get/job/<int:jid>', views.get_job), ###
    path('get/task/<int:tid>', views.get_task), ####
    path('dump/annotation/task/<int:tid>', views.dump_annotation), ###
    path('check/annotation/task/<int:tid>', views.check_annotation), ###
    path('download/annotation/task/<int:tid>', views.download_annotation), ###
    path('save/annotation/job/<int:jid>', views.save_annotation_for_job), ###
    path('save/annotation/task/<int:tid>', views.save_annotation_for_task), ###
    path('delete/annotation/task/<int:tid>', views.delete_annotation_for_task), ###
    path('get/annotation/job/<int:jid>', views.get_annotation), ###
    path('get/username', views.get_username), ###
    path('save/exception/<int:jid>', views.catch_client_exception), ###
    path('save/status/job/<int:jid>', views.save_job_status), ###

    path('', views.dispatch_request),
]
