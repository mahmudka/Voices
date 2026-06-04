@echo off
setlocal

set MSVC_VER=14.44.35207
set SDK_VER=10.0.26100.0

set MSVC_ROOT=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\%MSVC_VER%
set SDK_ROOT=C:\Program Files (x86)\Windows Kits\10

set MSVC_BIN=%MSVC_ROOT%\bin\Hostx64\x64
set SDK_BIN=%SDK_ROOT%\bin\%SDK_VER%\x64

set PATH=%MSVC_BIN%;%SDK_BIN%;%PATH%
set INCLUDE=%MSVC_ROOT%\include;%SDK_ROOT%\Include\%SDK_VER%\um;%SDK_ROOT%\Include\%SDK_VER%\ucrt;%SDK_ROOT%\Include\%SDK_VER%\shared
set LIB=%MSVC_ROOT%\lib\onecore\x64;%SDK_ROOT%\Lib\%SDK_VER%\um\x64;%SDK_ROOT%\Lib\%SDK_VER%\ucrt\x64

set CMAKE="C:\Program Files\CMake\bin\cmake.exe"
set BUILD_DIR=C:\Claude\Voices\Voices\world-service\build

if exist "%BUILD_DIR%" rmdir /s /q "%BUILD_DIR%"

%CMAKE% -S "C:\Claude\Voices\Voices\world-service" -B "%BUILD_DIR%" ^
    -G "NMake Makefiles" ^
    -DCMAKE_BUILD_TYPE=Release ^
    -DCMAKE_CXX_COMPILER="%MSVC_BIN%\cl.exe"
if errorlevel 1 goto :fail

%CMAKE% --build "%BUILD_DIR%"
if errorlevel 1 goto :fail

echo BUILD SUCCESS
goto :eof
:fail
echo BUILD FAILED
exit /b 1
endlocal
