<?php

return [
    /*
    |--------------------------------------------------------------------------
    | SOP Storage Disk
    |--------------------------------------------------------------------------
    |
    | Disk used for SOP document uploads. Defaults to FILESYSTEM_DISK so SOP
    | files follow the application's cloud/local storage setting.
    |
    */
    'storage_disk' => env('SOP_STORAGE_DISK', 'r2'),
];
