cmake_minimum_required(VERSION 3.21)
project(AexisDesktopShell VERSION 0.1 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)

find_package(Qt6 6.8 REQUIRED COMPONENTS Widgets WebEngineWidgets WebChannel)

qt_add_executable(aexis-desktop main.cpp)
qt_add_resources(aexis-desktop "workspace_manifests"
  PREFIX "/aexis"
  FILES integrations/tiled.json)
target_link_libraries(aexis-desktop PRIVATE Qt6::Widgets Qt6::WebEngineWidgets Qt6::WebChannel)

if(WIN32)
  set_target_properties(aexis-desktop PROPERTIES WIN32_EXECUTABLE TRUE)
endif()
