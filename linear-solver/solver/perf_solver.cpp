#include <algorithm>
#include <cmath>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

static const double EPS = 1e-9;

struct CaseData {
    std::string id;
    std::string expect;
    std::vector<std::vector<double>> matrix;
    std::vector<double> vector;
    std::vector<double> expected;
};

static std::string read_all(const std::string& path) {
    std::ifstream in(path);
    std::ostringstream ss;
    ss << in.rdbuf();
    return ss.str();
}

static bool parse_number_array(const std::string& src, const std::string& key, size_t startPos, std::vector<double>& out, size_t& endPos) {
    size_t k = src.find("\"" + key + "\"", startPos);
    if (k == std::string::npos) return false;
    size_t lb = src.find('[', k);
    size_t rb = src.find(']', lb);
    if (lb == std::string::npos || rb == std::string::npos) return false;
    std::string body = src.substr(lb + 1, rb - lb - 1);
    std::stringstream ss(body);
    std::string token;
    out.clear();
    while (std::getline(ss, token, ',')) {
      if (token.find_first_not_of(" \t\r\n") == std::string::npos) continue;
      out.push_back(std::stod(token));
    }
    endPos = rb + 1;
    return true;
}

static bool parse_matrix(const std::string& src, size_t startPos, std::vector<std::vector<double>>& mtx, size_t& endPos) {
    size_t mk = src.find("\"matrix\"", startPos);
    if (mk == std::string::npos) return false;
    size_t lb = src.find('[', mk);
    if (lb == std::string::npos) return false;
    size_t i = lb + 1;
    mtx.clear();
    while (i < src.size()) {
      while (i < src.size() && (src[i] == ' ' || src[i] == '\n' || src[i] == '\r' || src[i] == '\t' || src[i] == ',')) i++;
      if (i >= src.size()) return false;
      if (src[i] == ']') { endPos = i + 1; return true; }
      if (src[i] != '[') return false;
      size_t rowEnd = src.find(']', i);
      if (rowEnd == std::string::npos) return false;
      std::string rowBody = src.substr(i + 1, rowEnd - i - 1);
      std::stringstream ss(rowBody);
      std::string token;
      std::vector<double> row;
      while (std::getline(ss, token, ',')) {
        if (token.find_first_not_of(" \t\r\n") == std::string::npos) continue;
        row.push_back(std::stod(token));
      }
      mtx.push_back(row);
      i = rowEnd + 1;
    }
    return false;
}

static std::vector<CaseData> parse_cases(const std::string& text) {
    std::vector<CaseData> cases;
    size_t pos = text.find("\"cases\"");
    if (pos == std::string::npos) return cases;
    pos = text.find('[', pos);
    if (pos == std::string::npos) return cases;
    pos++;

    while (true) {
      size_t objStart = text.find('{', pos);
      if (objStart == std::string::npos) break;
      size_t objEnd = text.find('}', objStart);
      if (objEnd == std::string::npos) break;
      std::string obj = text.substr(objStart, objEnd - objStart + 1);
      if (obj.find("\"id\"") == std::string::npos) { pos = objEnd + 1; continue; }

      CaseData c;
      size_t idk = obj.find("\"id\"");
      size_t q1 = obj.find('"', obj.find(':', idk) + 1);
      size_t q2 = obj.find('"', q1 + 1);
      c.id = obj.substr(q1 + 1, q2 - q1 - 1);

      size_t exk = obj.find("\"expect\"");
      if (exk != std::string::npos) {
        size_t e1 = obj.find('"', obj.find(':', exk) + 1);
        size_t e2 = obj.find('"', e1 + 1);
        c.expect = obj.substr(e1 + 1, e2 - e1 - 1);
      } else {
        c.expect = "solve";
      }

      size_t p = 0;
      parse_matrix(obj, p, c.matrix, p);
      parse_number_array(obj, "vector", 0, c.vector, p);
      parse_number_array(obj, "expected_solution", 0, c.expected, p);
      cases.push_back(c);
      pos = objEnd + 1;
    }

    return cases;
}

static bool solve(const std::vector<std::vector<double>>& matrix, const std::vector<double>& b, std::vector<double>& out, std::string& err) {
    int n = static_cast<int>(matrix.size());
    if (n == 0) { err = "empty matrix"; return false; }
    for (const auto& row : matrix) if (static_cast<int>(row.size()) != n) { err = "matrix must be square"; return false; }
    if (static_cast<int>(b.size()) != n) { err = "dimension mismatch"; return false; }

    std::vector<std::vector<double>> aug(n, std::vector<double>(n + 1));
    for (int i = 0; i < n; i++) {
      for (int j = 0; j < n; j++) aug[i][j] = matrix[i][j];
      aug[i][n] = b[i];
    }

    for (int col = 0; col < n; col++) {
      int pivot = col;
      for (int r = col + 1; r < n; r++) {
        if (std::fabs(aug[r][col]) > std::fabs(aug[pivot][col])) pivot = r;
      }
      if (std::fabs(aug[pivot][col]) < EPS) { err = "singular"; return false; }
      if (pivot != col) std::swap(aug[pivot], aug[col]);
      for (int r = col + 1; r < n; r++) {
        double factor = aug[r][col] / aug[col][col];
        for (int c = col; c <= n; c++) aug[r][c] -= factor * aug[col][c];
      }
    }

    out.assign(n, 0.0);
    for (int i = n - 1; i >= 0; i--) {
      double sum = aug[i][n];
      for (int j = i + 1; j < n; j++) sum -= aug[i][j] * out[j];
      out[i] = sum / aug[i][i];
    }
    return true;
}

int main(int argc, char* argv[]) {
    if (argc != 3) {
      std::cerr << "usage: perf_solver <fixtures.json> <out.json>\n";
      return 2;
    }

    std::string fixturesText = read_all(argv[1]);
    std::vector<CaseData> cases = parse_cases(fixturesText);

    std::ofstream out(argv[2]);
    out << "{\n  \"solver\": \"cpp_perf\",\n  \"epsilon\": " << std::setprecision(12) << EPS << ",\n  \"results\": [\n";

    for (size_t i = 0; i < cases.size(); i++) {
      std::vector<double> sol;
      std::string err;
      bool ok = solve(cases[i].matrix, cases[i].vector, sol, err);
      std::string status = ok ? "pass" : (cases[i].expect == "singular" ? "blocked" : "fail");

      out << "    {\n";
      out << "      \"case_id\": \"" << cases[i].id << "\",\n";
      out << "      \"status\": \"" << status << "\",\n";
      out << "      \"solution\": [";
      for (size_t j = 0; j < sol.size(); j++) {
        if (j) out << ", ";
        out << std::setprecision(12) << sol[j];
      }
      out << "],\n";
      out << "      \"expect\": \"" << cases[i].expect << "\",\n";
      out << "      \"error\": \"" << err << "\"\n";
      out << "    }" << (i + 1 == cases.size() ? "\n" : ",\n");
    }

    out << "  ]\n}\n";
    return 0;
}
