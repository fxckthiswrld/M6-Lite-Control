'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('eqDiagnostic',{process:frame=>ipcRenderer.invoke('eq-diagnostic:frame',frame)});
