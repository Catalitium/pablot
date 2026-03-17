// Token Counter - C++ CLI Tool
// Counts tokens using multiple estimation methods

#include <iostream>
#include <fstream>
#include <string>
#include <sstream>
#include <vector>
#include <iomanip>
#include <cmath>
#include <algorithm>

using namespace std;

struct TokenCount {
    int words;
    int chars;
    int tokens_rough;
    int tokens_gpt;
    int tokens_claude;
};

TokenCount countTokens(const string& text) {
    TokenCount tc;
    tc.chars = text.length();

    // Count words
    istringstream iss(text);
    string word;
    tc.words = 0;
    while (iss >> word) {
        tc.words++;
    }

    // Rough estimate: 4 chars per token
    tc.tokens_rough = (int)ceil(tc.chars / 4.0);

    // GPT tokenizer approximation: ~0.75 words per token
    tc.tokens_gpt = (int)ceil(tc.words / 0.75);

    // Claude approximation: similar to GPT
    tc.tokens_claude = (int)ceil(tc.words / 0.75);

    return tc;
}

double estimateCost(int tokens, const string& model) {
    // Pricing per 1K tokens
    if (model == "gpt-4") return (tokens / 1000.0) * 0.03;
    if (model == "gpt-3.5") return (tokens / 1000.0) * 0.002;
    if (model == "claude-opus") return (tokens / 1000.0) * 0.015;
    if (model == "claude-sonnet") return (tokens / 1000.0) * 0.003;
    if (model == "claude-haiku") return (tokens / 1000.0) * 0.00025;
    if (model == "gemini-pro") return (tokens / 1000.0) * 0.00125;
    return 0.001; // default
}

void printResults(const TokenCount& tc, const string& model) {
    double cost = estimateCost(tc.tokens_gpt, model);

    cout << "\n╔══════════════════════════════════════╗\n";
    cout << "║         TOKEN COUNTER RESULTS         ║\n";
    cout << "╠══════════════════════════════════════╣\n";
    cout << "║ Characters: " << setw(24) << tc.chars << " ║\n";
    cout << "║ Words:      " << setw(24) << tc.words << " ║\n";
    cout << "╠══════════════════════════════════════╣\n";
    cout << "║ ESTIMATED TOKENS:                    ║\n";
    cout << "║  • Rough (4 chr): " << setw(18) << tc.tokens_rough << " ║\n";
    cout << "║  • GPT method:   " << setw(18) << tc.tokens_gpt << " ║\n";
    cout << "║  • Claude method:" << setw(18) << tc.tokens_claude << " ║\n";
    cout << "╠══════════════════════════════════════╣\n";

    if (model != "none") {
        cout << "║ ESTIMATED COST (" << model << "):     ║\n";
        cout << "║  Input:  $" << setw(23) << fixed << setprecision(4) << cost << " ║\n";
        cout << "║  Output: $" << setw(23) << cost * 0.5 << " ║\n";
        cout << "║  Total:  $" << setw(23) << cost * 1.5 << " ║\n";
    }

    cout << "╚══════════════════════════════════════╝\n";
}

void showHelp() {
    cout << "\nToken Counter - Usage:\n";
    cout << "  tokencounter                    (interactive)\n";
    cout << "  tokencounter -f <file>          (from file)\n";
    cout << "  tokencounter -t \"text\"         (from argument)\n";
    cout << "  tokencounter -m <model>         (with cost estimate)\n";
    cout << "\nModels for cost:\n";
    cout << "  gpt-4, gpt-3.5, claude-opus, claude-sonnet, claude-haiku, gemini-pro\n";
}

int main(int argc, char* argv[]) {
    cout << "\n🔢 TOKEN COUNTER v1.0\n";
    cout << "=====================\n";

    string text;
    string model = "none";

    // Parse arguments
    for (int i = 1; i < argc; i++) {
        string arg = argv[i];
        if (arg == "-h" || arg == "--help") {
            showHelp();
            return 0;
        }
        else if (arg == "-f" && i + 1 < argc) {
            ifstream file(argv[++i]);
            if (!file.is_open()) {
                cerr << "Error: Cannot open file " << argv[i] << "\n";
                return 1;
            }
            stringstream buffer;
            buffer << file.rdbuf();
            text = buffer.str();
            file.close();
        }
        else if (arg == "-t" && i + 1 < argc) {
            text = argv[++i];
        }
        else if (arg == "-m" && i + 1 < argc) {
            model = argv[++i];
        }
        else if (arg[0] != '-') {
            text += (text.empty() ? "" : " ") + arg;
        }
    }

    // Interactive mode if no input
    if (text.empty()) {
        cout << "\nEnter text (Ctrl+D to finish on Unix, Ctrl+Z on Windows):\n";
        string line;
        while (getline(cin, line)) {
            text += line + "\n";
        }
    }

    if (text.empty()) {
        cout << "No text provided.\n";
        return 1;
    }

    TokenCount tc = countTokens(text);
    printResults(tc, model);

    return 0;
}
