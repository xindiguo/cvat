
# Copyright (C) 2018 Intel Corporation
#
# SPDX-License-Identifier: MIT

from django.urls import path
from . import views

urlpatterns = [
    path('v1', views.api_root), # entry point for API
    path('v1/tasks/', None), # POST, GET
    path('v1/tasks/<int:tid>', None), # GET, DELETE, PUT
    path('v1/tasks/<int:tid>/frames/<int:frame>', None), # GET
    path('v1/tasks/<int:tid>/jobs/', None), # GET
    path('v1/jobs/<int:jid>', None), # GET, PUT
    path('v1/tasks/<int:tid>/annotations/', None), # GET, DELETE, PATCH
    path('v1/jobs/<int:jid>/annotations/', None), # GET, DELETE, PATCH
    path('v1/users/', None), # GET
    path('v1/users/myself', None), # GET
    path('v1/exceptions/', None), # POST
    path('v1/info/', None), # GET
    path('v1/plugins/', None), # GET
    path('v1/plugins/<slug:name>/config/', None), # GET, PUT
    path('v1/plugins/<slug:name>/requests/', None), # GET, POST
    path('v1/plugins/<slug:name>/requests/<int:id>', None), # GET, DELETE

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
