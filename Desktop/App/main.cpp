#include <QApplication>
#include <QDateTime>
#include <QDockWidget>
#include <QElapsedTimer>
#include <QFile>
#include <QFileDialog>
#include <QFileInfo>
#include <QFileSystemWatcher>
#include <QHBoxLayout>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonParseError>
#include <QLabel>
#include <QMainWindow>
#include <QPlainTextEdit>
#include <QPushButton>
#include <QSaveFile>
#include <QTabWidget>
#include <QTimer>
#include <QUrl>
#include <QVBoxLayout>
#include <QWebChannel>
#include <QWebEnginePage>
#include <QWebEngineView>
#include <QWidget>

namespace {
// Keep bridge copies bounded on the 4 GB target; the browser import allows more.
constexpr qint64 kMaxMapBytes = 8'000'000;
constexpr int kQuietSaveMs = 350;
}

class DesktopShell;

class ViewerBridge final : public QObject {
  Q_OBJECT
public:
  explicit ViewerBridge(DesktopShell *shell) : QObject(nullptr), shell_(shell) {}
public slots:
  void reportImport(const QString &status, const QString &detail);
private:
  DesktopShell *shell_;
};

class DesktopShell final : public QMainWindow {
  Q_OBJECT
public:
  DesktopShell(const QString &viewerUrl, bool debug)
      : viewerUrl_(viewerUrl), debug_(debug), bridge_(this) {
    QFile manifest(":/aexis/integrations/tiled.json");
    if (manifest.open(QIODevice::ReadOnly))
      integration_ = QJsonDocument::fromJson(manifest.readAll()).object();
    setWindowTitle("ÆXIS Desktop · workspace prototype");
    resize(1100, 740);
    tabs_ = new QTabWidget(this);
    setCentralWidget(tabs_);

    auto *mapTab = new QWidget(this);
    auto *layout = new QVBoxLayout(mapTab);
    auto *heading = new QLabel("Map editor host · integration pending", mapTab);
    heading->setStyleSheet("font-size: 18px; font-weight: 600");
    layout->addWidget(heading);
    layout->addWidget(new QLabel(
        "This tab is reserved for a tested native Tiled editor surface. "
        "The current prototype imports ordinary Tiled JSON only; it does not embed Tiled yet.", mapTab));
    auto *row = new QHBoxLayout;
    auto *select = new QPushButton("Choose project map JSON", mapTab);
    row->addWidget(select);
    row->addStretch();
    layout->addLayout(row);
    mapPathLabel_ = new QLabel("No project map selected", mapTab);
    mapPathLabel_->setTextInteractionFlags(Qt::TextSelectableByMouse);
    layout->addWidget(mapPathLabel_);
    layout->addStretch();
    tabs_->addTab(mapTab, "Map");
    tabs_->addTab(new QLabel("The world view loads when this tab is first opened."), "World");
    connect(select, &QPushButton::clicked, this, &DesktopShell::selectMap);
    connect(tabs_, &QTabWidget::currentChanged, this, [this](int index) {
      if (index == 1) ensureViewer();
      if (bridgeReady_) {
        viewer_->page()->runJavaScript(QString("window.__aexisDesktopSetActive?.(%1)")
                                           .arg(index == 1 ? "true" : "false"));
        if (index == 1 && pendingImport_) importMap();
      }
      record("tab", index == 1 ? "world" : "map");
    });

    debounce_.setSingleShot(true);
    debounce_.setInterval(kQuietSaveMs);
    connect(&debounce_, &QTimer::timeout, this, &DesktopShell::importMap);
    connect(&watcher_, &QFileSystemWatcher::fileChanged, this, [this] { debounce_.start(); });
    connect(&watcher_, &QFileSystemWatcher::directoryChanged, this, [this] {
      // Editors often replace a file atomically, removing the original watch.
      watchMap();
      debounce_.start();
    });

    if (debug_) {
      auto *dock = new QDockWidget("Diagnostics · local project", this);
      auto *body = new QWidget(dock);
      auto *bodyLayout = new QVBoxLayout(body);
      auto *tools = new QHBoxLayout;
      auto *inspect = new QPushButton("Inspect expected state", body);
      auto *exportLog = new QPushButton("Export diagnostics", body);
      tools->addWidget(inspect);
      tools->addWidget(exportLog);
      tools->addStretch();
      bodyLayout->addLayout(tools);
      debugText_ = new QPlainTextEdit(body);
      debugText_->setReadOnly(true);
      bodyLayout->addWidget(debugText_);
      dock->setWidget(body);
      addDockWidget(Qt::BottomDockWidgetArea, dock);
      dock->resize(900, 230);
      connect(inspect, &QPushButton::clicked, this, &DesktopShell::inspectState);
      connect(exportLog, &QPushButton::clicked, this, &DesktopShell::exportDiagnostics);
    }
    record("shell", "ready");
    inspectState();
  }

  void viewerReport(const QString &status, const QString &detail) {
    record("viewer-import", status + ": " + detail);
    if (status == "ready") {
      bridgeReady_ = true;
      if (!mapPath_.isEmpty()) importMap();
      return;
    }
    if (importTimer_.isValid()) {
      record("import-latency-ms", QString::number(importTimer_.elapsed()));
      importTimer_.invalidate();
    }
    if (status == "ok") statusBarMessage_ = "Loaded: " + detail;
    else statusBarMessage_ = "Import failed: " + detail;
    setWindowTitle("ÆXIS Desktop · " + statusBarMessage_);
  }

private:
  void record(const QString &event, const QString &detail) {
    if (!debugText_) return;
    QJsonObject entry{{"time", QDateTime::currentDateTimeUtc().toString(Qt::ISODateWithMs)},
                      {"event", event}, {"detail", detail}};
    debugText_->appendPlainText(QString::fromUtf8(QJsonDocument(entry).toJson(QJsonDocument::Compact)));
  }

  void inspectState() {
    if (!debugText_) return;
    QJsonObject state{
        {"expected", QJsonObject{{"oneWorkspace", true}, {"ordinaryTiledJson", true},
                                   {"webPreviewLazy", true}, {"nativeTiledTab", false},
                                   {"semanticExporterRoundTrip", false}}},
        {"integration", integration_},
        {"actual", QJsonObject{{"tab", tabs_->currentIndex() == 1 ? "world" : "map"},
                                 {"viewerCreated", viewer_ != nullptr},
                                 {"bridgeReady", bridgeReady_},
                                 {"mapSelected", !mapPath_.isEmpty()},
                                 {"mapBytes", mapPath_.isEmpty() ? 0.0 : double(QFileInfo(mapPath_).size())}}}};
    debugText_->appendPlainText(QString::fromUtf8(QJsonDocument(state).toJson(QJsonDocument::Compact)));
  }

  void exportDiagnostics() {
    const QString path = QFileDialog::getSaveFileName(this, "Save local diagnostics", {}, "JSON lines (*.jsonl)");
    if (path.isEmpty()) return;
    QSaveFile file(path);
    if (!file.open(QIODevice::WriteOnly)) { record("diagnostics", "could not write"); return; }
    file.write(debugText_->toPlainText().toUtf8());
    if (!file.commit()) record("diagnostics", "could not finish writing");
  }

  void selectMap() {
    const QString selected = QFileDialog::getOpenFileName(
        this, "Select an ordinary Tiled JSON map", {}, "Tiled JSON (*.json)");
    if (selected.isEmpty()) return;
    mapPath_ = QFileInfo(selected).canonicalFilePath();
    if (mapPath_.isEmpty()) return;
    mapPathLabel_->setText(mapPath_);
    watchMap();
    record("project-map", mapPath_);
    if (bridgeReady_) importMap();
  }

  void watchMap() {
    const QStringList old = watcher_.files() + watcher_.directories();
    if (!old.isEmpty()) watcher_.removePaths(old);
    if (mapPath_.isEmpty()) return;
    const QFileInfo info(mapPath_);
    if (info.exists()) watcher_.addPath(mapPath_);
    watcher_.addPath(info.absolutePath());
  }

  void ensureViewer() {
    if (viewer_) return;
    viewer_ = new QWebEngineView(tabs_);
    channel_.registerObject("aexisHost", &bridge_);
    viewer_->page()->setWebChannel(&channel_);
    tabs_->removeTab(1);
    tabs_->insertTab(1, viewer_, "World");
    tabs_->setCurrentIndex(1);
    connect(viewer_, &QWebEngineView::loadFinished, this, [this](bool ok) {
      record("viewer-load", ok ? "ready" : "failed");
      if (!ok) bridgeReady_ = false;
    });
    viewer_->load(QUrl(viewerUrl_));
    record("viewer-start", viewerUrl_);
  }

  void importMap() {
    if (mapPath_.isEmpty() || !viewer_ || !bridgeReady_) return;
    if (tabs_->currentIndex() != 1) {
      pendingImport_ = true;
      record("import-deferred", "world tab inactive");
      return;
    }
    pendingImport_ = false;
    watchMap();
    QFile file(mapPath_);
    if (!file.open(QIODevice::ReadOnly)) {
      record("map-read", "unavailable; preserving current world");
      return;
    }
    if (file.size() <= 0 || file.size() > kMaxMapBytes) {
      record("map-read", "empty or above 8 MB desktop limit; preserving current world");
      return;
    }
    const QByteArray bytes = file.readAll();
    QJsonParseError error;
    const QJsonDocument doc = QJsonDocument::fromJson(bytes, &error);
    if (error.error != QJsonParseError::NoError || !doc.isObject()) {
      record("map-read", "partial or invalid JSON; preserving current world");
      return;
    }
    // Base64 confines arbitrary JSON contents to a JS string literal. The viewer
    // parses and validates via its existing fromTiled() path before replacing state.
    const QString script = QStringLiteral("window.__aexisDesktopImport?.('%1')")
                               .arg(QString::fromLatin1(bytes.toBase64()));
    importTimer_.start();
    viewer_->page()->runJavaScript(script, [this](const QVariant &result) {
      record("import-dispatch", result.toString().isEmpty() ? "sent" : result.toString());
    });
  }

  QString viewerUrl_;
  bool debug_ = false;
  bool bridgeReady_ = false;
  bool pendingImport_ = false;
  QString mapPath_;
  QString statusBarMessage_;
  QJsonObject integration_;
  QTabWidget *tabs_ = nullptr;
  QLabel *mapPathLabel_ = nullptr;
  QPlainTextEdit *debugText_ = nullptr;
  QWebEngineView *viewer_ = nullptr;
  QWebChannel channel_;
  ViewerBridge bridge_;
  QFileSystemWatcher watcher_;
  QTimer debounce_;
  QElapsedTimer importTimer_;
};

void ViewerBridge::reportImport(const QString &status, const QString &detail) {
  shell_->viewerReport(status, detail);
}

int main(int argc, char *argv[]) {
  QApplication app(argc, argv);
  const QStringList args = app.arguments();
  const bool debug = args.contains("--debug");
  const int urlIndex = args.indexOf("--viewer-url");
  const QString url = (urlIndex >= 0 && urlIndex + 1 < args.size())
                          ? args.at(urlIndex + 1) : "http://127.0.0.1:5173";
  const QUrl parsed(url);
  if (parsed.scheme() != "http" ||
      (parsed.host() != "127.0.0.1" && parsed.host() != "localhost")) {
    qCritical("Viewer URL must be a local HTTP address.");
    return 2;
  }
  DesktopShell shell(url, debug);
  shell.show();
  return app.exec();
}

#include "main.moc"
