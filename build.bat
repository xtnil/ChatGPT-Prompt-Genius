REM Batch script for windows systems.
@echo off

REM First, create the dist directories if they don't already exist
mkdir "dist_mv3" "dist_mv2"

REM Copy the files from "src" to "dist_mv3" and "dist_mv2"
ROBOCOPY  "src" "dist_mv3" /xx
ROBOCOPY  "src" "dist_mv2" /xx

REM Copy the manifest files to their respective dist directories
ROBOCOPY  "manifests\mv3-manifest" "dist_mv3" /xx
ROBOCOPY  "manifests\mv2-manifest" "dist_mv2" /xx

REM For debugging so the window doesn't close
pause