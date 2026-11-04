import unittest
from validate import safe_name, valid_main

class TestManifest(unittest.TestCase):
    def test_valid(self):
        self.assertTrue(safe_name('main.tex'))
        self.assertTrue(safe_name('figures/plot.png'))
        self.assertTrue(valid_main('main.tex', {'main.tex'}))
    def test_traversal(self):
        for path in ['../passwd.tex','/etc/passwd.tex','C:/test.tex','../x.tex','foo/../../x.tex','foo//x.tex','foo\\x.tex','secret.sh','.env','figures/.secret.tex']:
            with self.subTest(path=path): self.assertFalse(safe_name(path))
    def test_main(self):
        self.assertFalse(valid_main('x.tex', {'main.tex'}))
        self.assertFalse(valid_main('../main.tex', {'../main.tex'}))

if __name__ == '__main__':
    unittest.main()
