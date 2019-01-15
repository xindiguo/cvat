
# Copyright (C) 2018 Intel Corporation
#
# SPDX-License-Identifier: MIT

from django.urls import path
from . import views

REST_API_PREFIX = 'api/<version>/'

urlpatterns = [
    path(REST_API_PREFIX, views.api_root), # entry point for API
    path(REST_API_PREFIX + 'tasks/', None), # GET, POST
    path(REST_API_PREFIX + 'tasks/<int:tid>', None), # GET, DELETE, PATCH
    path(REST_API_PREFIX + 'tasks/<int:tid>/frames/<int:frame>', None), # GET
    path(REST_API_PREFIX + 'tasks/<int:tid>/jobs/', None), # GET
    path(REST_API_PREFIX + 'jobs/<int:jid>', None), # GET, PATCH
    path(REST_API_PREFIX + 'tasks/<int:tid>/annotations/', None), # GET, DELETE, PATCH, PUT
    path(REST_API_PREFIX + 'jobs/<int:jid>/annotations/', None), # GET, DELETE, PATCH, PUT
    path(REST_API_PREFIX + 'users/', None), # GET
    path(REST_API_PREFIX + 'users/myself', None), # GET
    path(REST_API_PREFIX + 'exceptions/', None), # POST
    path(REST_API_PREFIX + 'info/', None), # GET
    path(REST_API_PREFIX + 'plugins/', None), # GET
    path(REST_API_PREFIX + 'plugins/<slug:name>/config/', None), # GET, PATCH, PUT
    path(REST_API_PREFIX + 'plugins/<slug:name>/data/', None), # GET, POST
    path(REST_API_PREFIX + 'plugins/<slug:name>/data/<int:id>', None), # GET, PATCH, DELETE, PUT
    path(REST_API_PREFIX + 'plugins/<slug:name>/requests/', None), # GET, POST
    path(REST_API_PREFIX + 'plugins/<slug:name>/requests/<int:id>', None), # GET, DELETE

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
