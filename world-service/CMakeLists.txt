cmake_minimum_required(VERSION 3.20)
project(world-service CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(MSVC_VER 14.44.35207)
set(SDK_VER  10.0.26100.0)

set(MSVC_ROOT "C:/Program Files (x86)/Microsoft Visual Studio/2022/BuildTools/VC/Tools/MSVC/${MSVC_VER}")
set(SDK_ROOT  "C:/Program Files (x86)/Windows Kits/10")

set(WORLD_SRC ${CMAKE_CURRENT_SOURCE_DIR}/World-master/src)

set(WORLD_SOURCES
    ${WORLD_SRC}/dio.cpp
    ${WORLD_SRC}/stonemask.cpp
    ${WORLD_SRC}/cheaptrick.cpp
    ${WORLD_SRC}/d4c.cpp
    ${WORLD_SRC}/synthesis.cpp
    ${WORLD_SRC}/synthesisrealtime.cpp
    ${WORLD_SRC}/common.cpp
    ${WORLD_SRC}/codec.cpp
    ${WORLD_SRC}/matlabfunctions.cpp
    ${WORLD_SRC}/harvest.cpp
    ${WORLD_SRC}/fft.cpp
)

add_executable(world-service main.cpp ${WORLD_SOURCES})

target_include_directories(world-service PRIVATE
    ${WORLD_SRC}
    ${CMAKE_CURRENT_SOURCE_DIR}
    "${SDK_ROOT}/Include/${SDK_VER}/um"
    "${SDK_ROOT}/Include/${SDK_VER}/ucrt"
    "${SDK_ROOT}/Include/${SDK_VER}/shared"
    "${MSVC_ROOT}/include"
)

target_compile_definitions(world-service PRIVATE
    _WIN32_WINNT=0x0A00
    NOMINMAX
    _CRT_SECURE_NO_WARNINGS
    WIN32_LEAN_AND_MEAN
)

target_compile_options(world-service PRIVATE /W1 /O2 /EHsc /MD)

target_link_directories(world-service PRIVATE
    "${MSVC_ROOT}/lib/onecore/x64"
    "${SDK_ROOT}/Lib/${SDK_VER}/um/x64"
    "${SDK_ROOT}/Lib/${SDK_VER}/ucrt/x64"
)

target_link_libraries(world-service PRIVATE WS2_32 AdvAPI32 ucrt msvcrt)
