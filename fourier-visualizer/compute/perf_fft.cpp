#include <cmath>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

struct Signal {
  std::string id;
  double sampleRate;
  std::vector<double> samples;
};

static std::string read_all(const std::string& p) {
  std::ifstream in(p);
  std::ostringstream ss;
  ss << in.rdbuf();
  return ss.str();
}

static bool parse_number_list(const std::string& src, const std::string& key, size_t pos, std::vector<double>& out, size_t& endPos) {
  size_t k = src.find("\"" + key + "\"", pos);
  if (k == std::string::npos) return false;
  size_t lb = src.find('[', k);
  size_t rb = src.find(']', lb);
  if (lb == std::string::npos || rb == std::string::npos) return false;
  std::stringstream ss(src.substr(lb + 1, rb - lb - 1));
  std::string token;
  out.clear();
  while (std::getline(ss, token, ',')) {
    if (token.find_first_not_of(" \n\r\t") == std::string::npos) continue;
    out.push_back(std::stod(token));
  }
  endPos = rb + 1;
  return true;
}

static std::vector<Signal> parse_signals(const std::string& text) {
  std::vector<Signal> out;
  size_t pos = text.find("\"signals\"");
  if (pos == std::string::npos) return out;
  pos = text.find('[', pos);
  if (pos == std::string::npos) return out;

  while (true) {
    size_t s = text.find('{', pos);
    if (s == std::string::npos) break;
    size_t e = text.find('}', s);
    if (e == std::string::npos) break;
    std::string obj = text.substr(s, e - s + 1);
    if (obj.find("\"id\"") == std::string::npos) { pos = e + 1; continue; }

    Signal sig;
    size_t idk = obj.find("\"id\"");
    size_t q1 = obj.find('"', obj.find(':', idk) + 1);
    size_t q2 = obj.find('"', q1 + 1);
    sig.id = obj.substr(q1 + 1, q2 - q1 - 1);

    size_t rk = obj.find("\"sample_rate\"");
    sig.sampleRate = 64.0;
    if (rk != std::string::npos) {
      size_t c = obj.find(':', rk);
      size_t end = obj.find_first_of(",}\n", c + 1);
      sig.sampleRate = std::stod(obj.substr(c + 1, end - c - 1));
    }

    size_t p = 0;
    parse_number_list(obj, "samples", 0, sig.samples, p);
    out.push_back(sig);
    pos = e + 1;
  }
  return out;
}

struct Bin { double freq; double amp; };

static std::vector<Bin> dft(const std::vector<double>& samples, double sampleRate) {
  int n = static_cast<int>(samples.size());
  int bins = n / 2;
  std::vector<Bin> out;
  out.reserve(bins);
  for (int k = 0; k < bins; k++) {
    double re = 0.0;
    double im = 0.0;
    for (int i = 0; i < n; i++) {
      double ang = -2.0 * M_PI * k * i / n;
      re += samples[i] * std::cos(ang);
      im += samples[i] * std::sin(ang);
    }
    double amp = std::sqrt(re * re + im * im) / n;
    out.push_back({k * sampleRate / n, amp});
  }
  return out;
}

int main(int argc, char* argv[]) {
  if (argc != 3) {
    std::cerr << "usage: perf_fft <fixtures.json> <out.json>\n";
    return 2;
  }

  auto text = read_all(argv[1]);
  auto signals = parse_signals(text);
  std::ofstream out(argv[2]);

  out << "{\n  \"solver\": \"cpp_perf_fft\",\n  \"cases\": [\n";
  for (size_t i = 0; i < signals.size(); i++) {
    auto spec = dft(signals[i].samples, signals[i].sampleRate);
    out << "    {\n";
    out << "      \"case_id\": \"" << signals[i].id << "\",\n";
    out << "      \"status\": \"pass\",\n";
    out << "      \"spectrum\": [";
    for (size_t b = 0; b < spec.size(); b++) {
      if (b) out << ",";
      out << "{\"frequency\":" << std::fixed << std::setprecision(6) << spec[b].freq
          << ",\"amplitude\":" << std::setprecision(12) << spec[b].amp << "}";
    }
    out << "]\n";
    out << "    }" << (i + 1 == signals.size() ? "\n" : ",\n");
  }
  out << "  ]\n}\n";
  return 0;
}
