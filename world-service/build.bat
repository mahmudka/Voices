@echo off
setlocal

set MSVC_VER=14.44.35207
set SDK_VER=10.0.26100.0

set MSVC_ROOT=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\%MSVC_VER%
set SDK_ROOT=C:\Program Files (x86)\Windows Kits\10

set PATH=%MSVC_ROOT%\bin\Hostx64\x64;%SDK_ROOT%\bin\%SDK_VER%\x64;%PATH%
set INCLUDE=%MSVC_ROOT%\include;%SDK_ROOT%\Include\%SDK_VER%\um;%SDK_ROOT%\Include\%SDK_VER%\ucrt;%SDK_ROOT%\Include\%SDK_VER%\shared
set LIB=%MSVC_ROOT%\lib\onecore\x64;%SDK_ROOT%\Lib\%SDK_VER%\um\x64;%SDK_ROOT%\Lib\%SDK_VER%\ucrt\x64

set WORLD_SRC=World-master\src
set OUT=world-service.exe

set WORLD_SOURCES=^
    %WORLD_SRC%\dio.cpp ^
    %WORLD_SRC%\stonemask.cpp ^
    %WORLD_SRC%\cheaptrick.cpp ^
    %WORLD_SRC%\d4c.cpp ^
    %WORLD_SRC%\synthesis.cpp ^
    %WORLD_SRC%\synthesisrealtime.cpp ^
    %WORLD_SRC%\common.cpp ^
    %WORLD_SRC%\codec.cpp ^
    %WORLD_SRC%\matlabfunctions.cpp ^
    %WORLD_SRC%\harvest.cpp ^
    %WORLD_SRC%\fft.cpp

echo Compiling world-service...
cl.exe /std:c++17 /O2 /EHsc /W1 /MD ^
    /D_WIN32_WINNT=0x0A00 /DNOMINMAX /D_CRT_SECURE_NO_WARNINGS ^
    /I%WORLD_SRC% /I. ^
    %WORLD_SOURCES% main.cpp ^
    /Fe:%OUT% ^
    /link ws2_32.lib Advapi32.lib

if %errorlevel% equ 0 (
    echo Build succeeded: %OUT%
) else (
    echo Build FAILED
    exit /b 1
)
endlocal
