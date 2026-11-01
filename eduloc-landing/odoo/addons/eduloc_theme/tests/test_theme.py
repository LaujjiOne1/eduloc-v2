from odoo.tests import HttpCase, tagged


def compiled_css(env, bundle_xmlid):
    bundle = env["ir.qweb"]._get_asset_bundle(bundle_xmlid, css=True, js=False)
    return "".join(attachment.raw.decode() for attachment in bundle.css()).lower()


@tagged("post_install", "-at_install")
class TestEdulocTheme(HttpCase):
    def test_backend_bundle_compiles_with_brand_tokens(self):
        css = compiled_css(self.env, "web.assets_backend")
        self.assertIn("#332e86", css, "La couleur primaire edUloc doit remplacer le violet Odoo (#71639e).")
        # Seule règle d'Odoo codée en dur avec son violet (sélecteur de tableau de l'éditeur) : elle est surchargée.
        self.assertEqual(css.count("#71639e"), 1)
        self.assertIn(".o-we-tablepicker .o-we-cell.active{background-color: #332e86", css.replace("\n", ""))
        self.assertIn("#faf9f4", css, "Fond papier.")
        self.assertIn("space grotesk", css)
        self.assertIn("/eduloc_theme/static/fonts/inter-latin.woff2", css)
        self.assertIn("linear-gradient(90deg, #332e86 0%, #8d7fe3 49%, #0e9c82 100%)", css, "Dégradé de marque.")

    def test_frontend_bundle_compiles_with_login_styles(self):
        css = compiled_css(self.env, "web.assets_frontend")
        self.assertIn(".eduloc-baseline", css)
        self.assertIn("#332e86", css)
        self.assertNotIn("#71639e", css)

    def test_fonts_are_served_locally(self):
        for name in ("Inter-latin", "Inter-latin-ext", "SpaceGrotesk-latin", "SpaceGrotesk-latin-ext"):
            response = self.url_open(f"/eduloc_theme/static/fonts/{name}.woff2")
            self.assertEqual(response.status_code, 200, name)
            self.assertEqual(response.content[:4], b"wOF2", name)

    def test_login_page_is_branded(self):
        html = self.url_open("/web/login").text
        self.assertIn("Le bon accompagnement,", html)
        self.assertIn("<title>edUloc</title>", html)
        self.assertIn("/eduloc_theme/static/img/favicon.png", html)
        self.assertNotIn("Powered by", html)
        self.assertNotIn("odoo.com?utm_source=db", html)

    def test_company_logo_and_colors(self):
        company = self.env.ref("base.main_company")
        self.assertTrue(company.logo, "Le logo edUloc doit être défini sur la société.")
        self.assertEqual(company.primary_color, "#332E86")
        self.assertEqual(company.secondary_color, "#8D7FE3")
        response = self.url_open("/web/binary/company_logo")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content[:8], b"\x89PNG\r\n\x1a\n")
